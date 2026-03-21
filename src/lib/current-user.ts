import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth-options";
import { isAdmin } from "@/lib/auth";

const IS_VERCEL = process.env.VERCEL === "1";
const REQUIRE_AUTH = process.env.REQUIRE_AUTH !== "false"; // Por defecto true, a menos que se diga false explícitamente.
const LOCAL_USER_EMAIL = (process.env.LOCAL_USER_EMAIL || "albertonava@gmail.com").trim().toLowerCase();

export type UserStatus = "normal" | "evaluar" | "suspendido" | "bloqueado";

export function isUserBlocked(status: UserStatus): boolean {
  return status === "suspendido" || status === "bloqueado";
}

function nextAuthJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  const isProd = process.env.NODE_ENV === "production" || IS_VERCEL;

  if (isProd && (!secret || secret.length < 32)) {
    console.warn("[AUTH] CRITICAL: NEXTAUTH_SECRET is missing or too short in production!");
    return "";
  }
  
  return (
    secret ||
    (process.env.NODE_ENV === "development" ? "dev-secret-freeboli-min-32-chars" : "")
  );
}

async function profileEmailByUserId(userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const supabase = createServiceClient(url, key);
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  const e = data?.email?.trim();
  return e || null;
}

/** Misma resolución JWT+cookies que usa NextAuth internamente. */
async function tryIdentityFromJwtCookies(): Promise<{
  id: string;
  email: string;
  name?: string;
  sessionForEmailCheck: Session;
} | null> {
  const secret = nextAuthJwtSecret();
  if (!secret) return null;
  try {
    const cookieStore = await cookies();
    const headersList = await headers();
    const reqLike = {
      headers: Object.fromEntries(headersList.entries()),
      cookies: Object.fromEntries(cookieStore.getAll().map((c) => [c.name, c.value])),
    };
    const token = await getToken({
      req: (reqLike as unknown) as NextRequest,
      secret,
    });
    if (!token?.sub) return null;
    let email = typeof token.email === "string" && token.email ? token.email.trim() : "";
    if (!email) email = (await profileEmailByUserId(token.sub)) ?? "";
    if (!email) return null;
    const sessionForEmailCheck = { user: { email } } as Session;
    return {
      id: token.sub,
      email,
      name: (token.name as string | null | undefined) ?? undefined,
      sessionForEmailCheck,
    };
  } catch {
    return null;
  }
}

/**
 * Admin: sesión/JWT + ADMIN_EMAILS o is_admin en BD.
 * Solo Supabase service role para leer perfil (evita RLS/cookies del cliente SSR en Server Actions).
 */
export async function getAdminUser(): Promise<CurrentUser | null> {
  try {
    const session = await getServerSession(authOptions);

    let id: string | undefined;
    let email = "";
    let name: string | undefined;
    let sessionForEmailCheck: Session | null = null;

    if (session?.user) {
      id = (session.user as { id?: string }).id;
      email = session.user.email?.trim() || "";
      name = session.user.name ?? undefined;
      if (id && !email) email = (await profileEmailByUserId(id)) ?? "";
      if (id && email) {
        sessionForEmailCheck = { ...session, user: { ...session.user, email } } as Session;
      }
    }

    if (!id || !email || !sessionForEmailCheck) {
      const fromJwt = await tryIdentityFromJwtCookies();
      if (!fromJwt) return null;
      id = fromJwt.id;
      email = fromJwt.email;
      name = fromJwt.name;
      sessionForEmailCheck = fromJwt.sessionForEmailCheck;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;

    const sb = createServiceClient(url, key);
    const { data: profile } = await sb
      .from("profiles")
      .select("status, is_admin")
      .eq("id", id)
      .maybeSingle();

    const byEnv = isAdmin(sessionForEmailCheck);
    const byDb = !!profile?.is_admin;
    if (!byEnv && !byDb) return null;

    return {
      id,
      email,
      name,
      isAdmin: true,
      status: (profile?.status as UserStatus) || "normal",
    };
  } catch {
    return null;
  }
}

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  isAdmin: boolean;
  status: UserStatus;
}

/**
 * Devuelve el usuario actual: sesión real si REQUIRE_AUTH=true, o usuario local si no.
 * En local (REQUIRE_AUTH !== 'true') sin sesión usa LOCAL_USER_EMAIL.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as { id?: string }).id) {
    return (session.user as { id: string }).id;
  }
  if (REQUIRE_AUTH) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", LOCAL_USER_EMAIL)
    .single();
  return data?.id ?? null;
}

/**
 * Devuelve el usuario actual con email e isAdmin (para /api/me y layout).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as { id?: string }).id) {
    const id = (session.user as { id: string }).id;
    const isAdmin = (session.user as { isAdmin?: boolean }).isAdmin ?? false;
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", id)
      .single();
    return {
      id,
      email: session.user.email ?? "",
      name: session.user.name ?? undefined,
      isAdmin,
      status: (profile?.status as UserStatus) || "normal",
    };
  }
  if (REQUIRE_AUTH) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, name, is_admin, status")
    .eq("email", LOCAL_USER_EMAIL)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email ?? LOCAL_USER_EMAIL,
    name: data.name ?? undefined,
    isAdmin: !!data.is_admin,
    status: (data.status as UserStatus) || "normal",
  };
}
