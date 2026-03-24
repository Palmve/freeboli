import type { Session } from "next-auth";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(session: Session | null): boolean {
  const email = session?.user?.email?.toLowerCase();
  return !!email && (ADMIN_EMAILS.includes(email) || !!(session?.user as any)?.isStaff);
}

export function isSuperAdmin(session: Session | null): boolean {
  const email = session?.user?.email?.toLowerCase();
  // El primer email en la lista de ADMIN_EMAILS es el Super Admin (inborrable)
  return !!email && ADMIN_EMAILS[0] === email;
}

export interface StaffPermissions {
  promotions?: boolean;
  users?: boolean;
  finances?: boolean;
  settings?: boolean;
}

/**
 * Retorna los permisos específicos del staff.
 * Si es admin total (en ADMIN_EMAILS), tiene todos los permisos.
 */
export function getPermissions(session: Session | null): StaffPermissions {
  const email = session?.user?.email?.toLowerCase();
  if (!!email && ADMIN_EMAILS.includes(email)) {
    return { promotions: true, users: true, finances: true, settings: true };
  }
  return (session?.user as any)?.permissions || {};
}

/** Admin global o staff con permiso promotions. */
export function canManagePromotionsAdmin(session: Session | null): boolean {
  if (!session?.user?.isAdmin) return false;
  const u = session.user as { isStaff?: boolean };
  if (u.isStaff && !getPermissions(session).promotions) return false;
  return true;
}
