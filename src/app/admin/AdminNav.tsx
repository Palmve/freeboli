"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <nav className="overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex min-w-max gap-2 border-b border-slate-700/50 pb-px">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap rounded-t-xl px-4 py-3 text-xs sm:text-sm font-bold transition-all ${
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
  );
}
