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
 * Obtiene el usuario admin/staff si tiene sesión válida y el dispositivo es de confianza.
 * @param requiredPermission Permiso opcional (ej. 'promotions', 'finances').
 */
export async function getAdminUser(requiredPermission?: string): Promise<CurrentUser | null> {
  try {
    const session = await getServerSession(authOptions);
    const { canAccessAdmin } = await import("./auth");

    // canAccessAdmin ya verifica: isAdmin, isDeviceTrusted y specific permissions.
    if (!canAccessAdmin(session, requiredPermission as any)) {
      if (session?.user && (session.user as any).isAdmin) {
         console.warn(`[Security] Bloqueo de acceso administrativo (Falta PIN o Permiso): ${session.user.email}`);
      }
      return null;
    }

    const u = session!.user as any;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      isAdmin: true,
      isStaff: !!u.isStaff,
      permissions: u.permissions || {},
      status: "normal", // Podríamos fetch status real si fuera necesario, pero para admin basta con la sesión
    };
  } catch (err) {
    console.error("[getAdminUser] Error:", err);
    return null;
  }
}

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  isAdmin: boolean;
  isStaff?: boolean;
  permissions?: any;
  status: UserStatus;
  withdrawLimitOverrideUntil?: string | null;
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
      .select("status, withdraw_limit_override_until")
      .eq("id", id)
      .single();
    return {
      id,
      email: session.user.email ?? "",
      name: session.user.name ?? undefined,
      isAdmin,
      status: (profile?.status as UserStatus) || "normal",
      withdrawLimitOverrideUntil: profile?.withdraw_limit_override_until,
    };
  }
  if (REQUIRE_AUTH) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, name, is_admin, status, withdraw_limit_override_until")
    .eq("email", LOCAL_USER_EMAIL)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email ?? LOCAL_USER_EMAIL,
    name: data.name ?? undefined,
    isAdmin: !!data.is_admin,
    status: (data.status as UserStatus) || "normal",
    withdrawLimitOverrideUntil: data.withdraw_limit_override_until,
  };
}
