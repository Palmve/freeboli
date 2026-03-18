"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [localUser, setLocalUser] = useState<{ email?: string; isAdmin?: boolean } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (REQUIRE_AUTH || session?.user) return;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setLocalUser(d.user ?? null))
      .catch(() => setLocalUser(null));
  }, [session?.user]);

  useEffect(() => {
    if (session?.user || localUser) {
      fetch("/api/faucet")
        .then((r) => r.json())
        .then((d) => setBalance(d.points ?? 0))
        .catch(() => setBalance(null));
    }
  }, [session?.user, localUser]);

  useEffect(() => {
    const onBalanceUpdate = (e: CustomEvent<number>) => {
      if (typeof e.detail === "number") setBalance(e.detail);
    };
    window.addEventListener("freeboli-balance-update", onBalanceUpdate as EventListener);
    return () => window.removeEventListener("freeboli-balance-update", onBalanceUpdate as EventListener);
  }, []);

  const loggedIn = !!session?.user || !!localUser;
  const showAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin ?? localUser?.isAdmin ?? false;
  const isHiLo = pathname === "/hi-lo";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-amber-400">
          FreeBoli
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className={`${pathname === "/" ? "text-white" : "text-slate-300"} hover:text-white`}>
            Inicio
          </Link>
          <Link href="/faucet" className={`${pathname === "/faucet" ? "text-white" : "text-slate-300"} hover:text-white`}>
            Faucet
          </Link>
          <Link href="/hi-lo" className={`${isHiLo ? "text-emerald-400 font-semibold" : "text-slate-300"} hover:text-white`}>
            HI-LO
          </Link>
          <Link href="/afiliados" className={`${pathname === "/afiliados" ? "text-white" : "text-slate-300"} hover:text-white`}>
            Afiliados
          </Link>
          <Link href="/recompensas" className={`${pathname === "/recompensas" ? "text-white" : "text-slate-300"} hover:text-white`}>
            Recompensas
          </Link>
          {loggedIn ? (
            <>
              <Link href="/cuenta/depositar" className="rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500">
                Depositar
              </Link>
              <Link href="/cuenta" className="rounded border border-emerald-500 px-3 py-1.5 font-medium text-emerald-400 hover:bg-emerald-500/20">
                Retirar
              </Link>
              <span className="ml-2 rounded bg-slate-800 px-3 py-1.5 font-mono text-sm text-amber-400">
                {balance != null ? `${balance.toLocaleString()} pts` : "—"}
              </span>
              <Link href="/cuenta" className="text-slate-300 hover:text-white">
                Mi cuenta
              </Link>
              {showAdmin && (
                <Link href="/admin" className="text-slate-400 hover:text-amber-400">
                  Admin
                </Link>
              )}
              {!REQUIRE_AUTH && (
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  Modo local
                </span>
              )}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn-primary text-sm"
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-slate-300 hover:text-white">
                Entrar
              </Link>
              <Link href="/auth/registro" className="btn-primary text-sm">
                Registrarse
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
