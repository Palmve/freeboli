import type { Session } from "next-auth";

import { cookies } from "next/headers";
import { deviceTrustCookieName, verifyDeviceTrustValue } from "./device-trust";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Super Admin (Propietario) */
export function isSuperAdmin(session: Session | null): boolean {
  const email = session?.user?.email?.toLowerCase();
  return !!email && ADMIN_EMAILS[0] === email;
}

/** Admin Global o Staff */
export function isAdmin(session: Session | null): boolean {
  const email = session?.user?.email?.toLowerCase();
  if (!email) return false;
  
  // Super Admins
  if (ADMIN_EMAILS.includes(email)) return true;
  
  // Staff delegado (marcado por sesión)
  return !!(session?.user as any)?.isStaff;
}

/** 
 * Verifica si el dispositivo actual está autorizado mediante PIN.
 * Hardened: Impide bypass de PIN desde scripts fuera del navegador autorizado.
 */
export function isDeviceTrusted(session: Session | null): boolean {
  if (!session?.user) return false;
  
  // OPCIONAL: SuperAdmins podrían estar exentos o no (por seguridad, mejor dejarlo para todos)
  // Pero si el usuario es SuperAdmin y está en localhost, omitimos para desarrollo
  if (isSuperAdmin(session) && process.env.NODE_ENV === "development") return true;

  const userId = (session.user as any).id;
  if (!userId) return false;

  const cookieStore = cookies();
  const deviceCookie = cookieStore.get(deviceTrustCookieName(userId));

  return verifyDeviceTrustValue(userId, deviceCookie?.value);
}

export interface StaffPermissions {
  promotions?: boolean;
  users?: boolean;
  finances?: boolean;
  settings?: boolean;
}

export function getPermissions(session: Session | null): StaffPermissions {
  const email = session?.user?.email?.toLowerCase();
  if (!!email && ADMIN_EMAILS.includes(email)) {
    return { promotions: true, users: true, finances: true, settings: true };
  }
  return (session?.user as any)?.permissions || {};
}

/** 
 * GUARDIA ADMINISTRATIVO: Combinación de ROL + PERMISO + DISPOSITIVO 
 */
export function canAccessAdmin(session: Session | null, requiredPermission?: keyof StaffPermissions): boolean {
  if (!isAdmin(session)) return false;
  if (!isDeviceTrusted(session)) return false;

  if (isSuperAdmin(session)) return true;

  // Si es staff, verificar permiso específico
  if (requiredPermission) {
    const perms = getPermissions(session);
    return !!perms[requiredPermission];
  }

  return true;
}

/** @deprecated Usar canAccessAdmin(session, 'promotions') */
export function canManagePromotionsAdmin(session: Session | null): boolean {
  return canAccessAdmin(session, 'promotions');
}
