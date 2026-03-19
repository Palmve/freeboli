"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

interface UserMeta {
  email?: string;
  isAdmin?: boolean;
  level?: { level: number; name: string; icon: string; color: string };
}

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [localUser, setLocalUser] = useState<UserMeta | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userLevel, setUserLevel] = useState<{ level: number; name: string; icon: string; color: string } | null>(null);

  useEffect(() => {
    if (REQUIRE_AUTH || session?.user) return;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setLocalUser(d.user ?? null))
      .catch(() => setLocalUser(null));
  }, [session?.user]);

  const refreshBalance = useCallback(() => {
    if (session?.user || localUser) {
      fetch("/api/faucet")
        .then((r) => r.json())
        .then((d) => setBalance(d.points ?? 0))
        .catch(() => setBalance(null));
    }
  }, [session?.user, localUser]);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  useEffect(() => {
    if (session?.user || localUser) {
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => {
          if (d.level) setUserLevel(d.level);
        })
        .catch(() => {});
    }
  }, [session?.user, localUser]);

  useEffect(() => {
    const onBalanceUpdate = (e: CustomEvent<number>) => {
      if (typeof e.detail === "number") setBalance(e.detail);
    };
    window.addEventListener("freeboli-balance-update", onBalanceUpdate as EventListener);
    return () => window.removeEventListener("freeboli-balance-update", onBalanceUpdate as EventListener);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const loggedIn = !!session?.user || !!localUser;
  const showAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin ?? localUser?.isAdmin ?? false;

  const navLinks = [
    { href: "/", label: "Inicio" },
    { href: "/faucet", label: "Faucet" },
    { href: "/hi-lo", label: "HI-LO" },
    { href: "/clasificacion", label: "Ranking" },
    { href: "/afiliados", label: "Afiliados" },
    { href: "/recompensas", label: "Recompensas" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-amber-400 shrink-0">
          FreeBoli
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-3 text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${pathname === link.href ? "text-white font-semibold" : "text-slate-300"} hover:text-white`}
            >
              {link.label}
            </Link>
          ))}
          {loggedIn ? (
            <>
              <Link
                href="/cuenta/depositar"
                className={`rounded px-3 py-1.5 text-xs font-semibold ${
                  pathname === "/cuenta/depositar"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Depositar
              </Link>
              <Link
                href="/cuenta/retirar"
                className={`rounded px-3 py-1.5 text-sm ${
                  pathname === "/cuenta/retirar"
                    ? "bg-slate-700 text-white font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Retiro
              </Link>
              <Link
                href="/cuenta"
                className={`rounded px-3 py-1.5 text-sm ${
                  pathname === "/cuenta"
                    ? "bg-slate-700 text-white font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Mi cuenta
              </Link>
              {showAdmin && (
                <Link
                  href="/admin"
                  className={`rounded px-3 py-1.5 text-sm ${
                    pathname?.startsWith("/admin") ? "bg-slate-700 text-amber-400 font-semibold" : "text-slate-400 hover:text-amber-400"
                  }`}
                >
                  Admin
                </Link>
              )}
              <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="btn-primary text-sm">
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-slate-300 hover:text-white">Entrar</Link>
              <Link href="/auth/registro" className="btn-primary text-sm">Registrarse</Link>
            </>
          )}
        </nav>

        {/* Right side: balance (always visible) + hamburger */}
        <div className="flex items-center gap-2">
          {loggedIn && (
            <Link href="/cuenta" className="flex items-center gap-1.5 rounded bg-slate-800 px-2.5 py-1.5 shrink-0">
              {userLevel && (
                <span className={`text-sm ${userLevel.color}`} title={userLevel.name}>
                  {userLevel.icon}
                </span>
              )}
              <span className="font-mono text-sm text-amber-400">
                {balance != null ? `${balance.toLocaleString()} pts` : "..."}
              </span>
            </Link>
          )}

          {/* Hamburger button - mobile only */}
          <button
            type="button"
            className="md:hidden rounded p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-700 bg-slate-900">
          <nav className="flex flex-col px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2.5 text-sm ${
                  pathname === link.href ? "bg-slate-800 text-white font-semibold" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-slate-700 my-2" />
            {loggedIn ? (
              <>
                <Link
                  href="/cuenta/depositar"
                  className={`rounded-lg px-3 py-2.5 text-sm ${
                    pathname === "/cuenta/depositar"
                      ? "bg-emerald-600/30 text-emerald-400 font-semibold"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Depositar
                </Link>
                <Link
                  href="/cuenta/retirar"
                  className={`rounded-lg px-3 py-2.5 text-sm ${
                    pathname === "/cuenta/retirar"
                      ? "bg-slate-800 text-white font-semibold"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Retiro
                </Link>
                <Link
                  href="/cuenta"
                  className={`rounded-lg px-3 py-2.5 text-sm ${
                    pathname === "/cuenta"
                      ? "bg-slate-800 text-white font-semibold"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Mi cuenta
                </Link>
                {showAdmin && (
                  <Link
                    href="/admin"
                    className={`rounded-lg px-3 py-2.5 text-sm ${
                      pathname?.startsWith("/admin") ? "bg-slate-800 text-amber-400 font-semibold" : "text-amber-400 hover:bg-slate-800"
                    }`}
                  >
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-lg px-3 py-2.5 text-sm text-left text-red-400 hover:bg-slate-800"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
                  Entrar
                </Link>
                <Link href="/auth/registro" className="rounded-lg bg-amber-500/20 px-3 py-2.5 text-sm text-amber-400 font-medium">
                  Registrarse
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
