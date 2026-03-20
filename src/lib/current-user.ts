import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";

const IS_VERCEL = process.env.VERCEL === "1";
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true" || IS_VERCEL;
const LOCAL_USER_EMAIL = (process.env.LOCAL_USER_EMAIL || "albertonava@gmail.com").trim().toLowerCase();

export type UserStatus = "normal" | "evaluar" | "suspendido" | "bloqueado";

export function isUserBlocked(status: UserStatus): boolean {
  return status === "suspendido" || status === "bloqueado";
}

/**
 * Usuario admin: SIEMPRE requiere sesión autenticada y email en ADMIN_EMAILS.
 * Nunca usa el bypass LOCAL_USER. Usar en layout admin y rutas API admin.
 */
export async function getAdminUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session)) return null;
  const id = (session.user as { id?: string }).id;
  if (!id) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", id)
    .single();
  return {
    id,
    email: session.user.email,
    name: session.user.name ?? undefined,
    isAdmin: true,
    status: (profile?.status as UserStatus) || "normal",
  };
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
