"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

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
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const currentTab =
    filteredTabs.find((t) => isAdminTabActive(pathname, t.href)) ?? filteredTabs[0];

  return (
    <>
      {/* Móvil: cabecera colapsable; al elegir enlace se contrae. */}
      <div className="mb-4 block md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-left text-sm font-bold text-amber-400"
          aria-expanded={mobileOpen}
          aria-controls="admin-nav-mobile-list"
        >
          <span className="min-w-0 truncate">{currentTab?.label ?? "Administración"}</span>
          <svg
            className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${mobileOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {mobileOpen && (
          <nav
            id="admin-nav-mobile-list"
            aria-label="Navegación administración"
            className="mt-2 max-h-[min(70vh,520px)] overflow-y-auto overscroll-y-contain rounded-xl border border-slate-700 bg-slate-900/60 p-2 [-webkit-overflow-scrolling:touch]"
          >
            <ul className="flex flex-col gap-0.5">
              {filteredTabs.map((tab) => {
                const active = isAdminTabActive(pathname, tab.href);
                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      onClick={() => setMobileOpen(false)}
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
        )}
      </div>

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
