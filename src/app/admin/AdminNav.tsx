"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/wallets", label: "Wallets" },
  { href: "/admin/depositos", label: "Depósitos" },
  { href: "/admin/retiros", label: "Retiros" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/visitas", label: "Visitas" },
  { href: "/admin/ranking", label: "Ranking" },
  { href: "/admin/estadisticas", label: "Estadísticas" },
  { href: "/admin/proyecciones", label: "Proyecciones" },
  { href: "/admin/alertas", label: "Alertas" },
  { href: "/admin/configuracion", label: "Configuración" },
  { href: "/admin/bot", label: "Bot Volumen 🔥" },
  { href: "/admin/seguridad", label: "Seguridad" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Menú Desplegable para Móviles (Android/iOS) */}
      <div className="block md:hidden mb-4 px-1">
        <label htmlFor="admin-nav-select" className="sr-only">Navegación Administrador</label>
        <div className="relative">
          <select
            id="admin-nav-select"
            value={pathname}
            onChange={(e) => router.push(e.target.value)}
            className="w-full appearance-none rounded-xl border-2 border-slate-700 bg-slate-800/80 px-4 py-3.5 pr-10 text-[15px] font-bold text-amber-500 shadow-md outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
          >
            {tabs.map((tab) => (
              <option key={tab.href} value={tab.href} className="bg-slate-800 text-amber-500 font-semibold">
                {tab.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-amber-500">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Menú de Pestañas Horizontales (Usuarios de PC/Tableta) */}
      <nav className="hidden md:block overflow-x-auto pb-4 scrollbar-hide">
        <div className="flex min-w-max gap-2 border-b border-slate-700/50 pb-px">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
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
