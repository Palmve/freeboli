"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const tabs = [
  { href: "/admin", label: "Resumen", superOnly: true },
  { href: "/admin/wallets", label: "Wallets", permission: "finances" },
  { href: "/admin/depositos", label: "Depósitos", permission: "finances" },
  { href: "/admin/retiros", label: "Retiros", permission: "finances" },
  { href: "/admin/usuarios", label: "Usuarios", permission: "users" },
  { href: "/admin/visitas", label: "Visitas", permission: "stats" },
  { href: "/admin/ranking", label: "Ranking", permission: "stats" },
  { href: "/admin/estadisticas", label: "Estadísticas", permission: "stats" },
  { href: "/admin/proyecciones", label: "Proyecciones", permission: "stats" },
  { href: "/admin/alertas", label: "Alertas", superOnly: true },
  { href: "/admin/configuracion", label: "Configuración", permission: ["settings", "promotions"] },
  { href: "/admin/bot", label: "Bot volumen", superOnly: true },
  { href: "/admin/seguridad", label: "Seguridad", permission: "security" },
];

/** Ruta activa: coincide exacto o subruta (p. ej. /admin/usuarios/uuid → Usuarios). */
function isAdminTabActive(pathname: string, tabHref: string): boolean {
  if (pathname === tabHref) return true;
  if (tabHref === "/admin") return false;
  return pathname.startsWith(`${tabHref}/`);
}

export default function AdminNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const user = session?.user as any;
  const isSuper = user?.isSuperAdmin;
  const permissions = user?.permissions || {};

  const filteredTabs = tabs.filter(tab => {
    if (isSuper) return true;
    if (tab.superOnly) return false;
    if (Array.isArray(tab.permission)) {
      return tab.permission.some(p => permissions[p]);
    }
    if (tab.permission) return permissions[tab.permission];
    return false;
  });

  if (filteredTabs.length === 0 && !isSuper) return null;

  return (
    <>
      {/* Móvil: lista vertical con scroll (evita bugs de <select> en Android y rutas anidadas). */}
      <nav
        aria-label="Navegación administración"
        className="block md:hidden mb-4 rounded-xl border border-slate-700 bg-slate-900/60 p-2 max-h-[min(72vh,560px)] overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
      >
        <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Secciones</p>
        <ul className="flex flex-col gap-0.5">
          {filteredTabs.map((tab) => {
            const active = isAdminTabActive(pathname, tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={`block rounded-lg px-3 py-3 text-sm font-bold transition-colors ${
                    active
                      ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/40"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white active:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="hidden md:block overflow-x-auto pb-4 scrollbar-hide">
        <div className="flex min-w-max gap-2 border-b border-slate-700/50 pb-px">
          {filteredTabs.map((tab) => {
            const active = isAdminTabActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap rounded-t-xl px-4 py-3 text-sm font-bold transition-all ${
                  active
                    ? "border-b-2 border-amber-500 bg-amber-500/10 text-amber-500 shadow-[0_-2px_10px_rgba(245,158,11,0.1)]"
                    : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
