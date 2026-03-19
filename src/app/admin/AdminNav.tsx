"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/wallets", label: "Wallets" },
  { href: "/admin/depositos", label: "Depósitos" },
  { href: "/admin/retiros", label: "Retiros" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/ranking", label: "Ranking" },
  { href: "/admin/estadisticas", label: "Estadísticas" },
  { href: "/admin/proyecciones", label: "Proyecciones" },
  { href: "/admin/alertas", label: "Alertas" },
  { href: "/admin/configuracion", label: "Configuración" },
  { href: "/admin/seguridad", label: "Seguridad" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 border-b border-slate-700 pb-px">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-b-2 border-amber-400 bg-slate-800/60 text-amber-400"
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
