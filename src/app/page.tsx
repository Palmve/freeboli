"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { POINTS_PER_BOLIS } from "@/lib/config";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export default function HomePage() {
  const { data: session, status } = useSession();
  const loggedIn = !!session?.user || !REQUIRE_AUTH;
  const loading = REQUIRE_AUTH && status === "loading";

  return (
    <div className="space-y-16 py-8">
      <section className="text-center">
        <h1 className="mb-4 text-4xl font-black tracking-tighter text-white md:text-6xl drop-shadow-2xl">
          Gana puntos gratis cada hora
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-400 font-medium">
          Juega al faucet, multiplica en HI-LO y retira en{" "}
          <span className="font-black text-emerald-400">BOLIS</span> de Solana.
          <br />
          <span className="text-amber-500 font-bold">
            {String(POINTS_PER_BOLIS)} puntos = 1 BOLIS
          </span>
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {loading ? (
            <div className="h-16" />
          ) : loggedIn ? (
            <>
              <Link href="/faucet" className="bg-slate-100 text-slate-900 font-black rounded-xl text-lg px-8 py-4 hover:bg-white transition shadow-xl border-b-4 border-slate-300 active:border-b-0 active:translate-y-1">
                Ir al Faucet
              </Link>
              <Link href="/predicciones" className="bg-amber-500 text-slate-950 font-black rounded-xl text-lg px-8 py-4 hover:bg-amber-400 transition shadow-xl shadow-amber-500/20 border-b-4 border-amber-600 active:border-b-0 active:translate-y-1">
                Jugar Predicción
              </Link>
              <Link href="/hi-lo" className="bg-slate-800 text-white font-black rounded-xl text-lg px-8 py-4 hover:bg-slate-700 transition shadow-xl border-b-4 border-slate-950 active:border-b-0 active:translate-y-1">
                Jugar HI-LO
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/registro" className="bg-amber-500 text-slate-950 font-black rounded-xl text-lg px-8 py-4 hover:bg-amber-400 transition shadow-xl shadow-amber-500/20 border-b-4 border-amber-600 active:border-b-0 active:translate-y-1">
                Jugar ahora
              </Link>
              <Link href="/auth/login" className="bg-slate-800 text-white font-black rounded-xl text-lg px-8 py-4 hover:bg-slate-700 transition shadow-xl border-b-4 border-slate-950 active:border-b-0 active:translate-y-1">
                Entrar
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Predicción BTC */}
        <Link href="/predicciones?asset=BTC" className="card border-l-4 border-amber-500 hover:bg-slate-800/50 transition duration-300 group block">
          <h2 className="mb-2 text-xl font-black text-white flex items-center gap-2 group-hover:text-amber-400 transition">
            <span className="text-amber-500">₿</span> BTC Predicción
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed text-left">
            ¿Subirá o bajará el Bitcoin en la próxima hora? Gana multiplicando tus puntos con cuotas dinámicas.
          </p>
          <span className="mt-4 inline-block font-black text-amber-500 group-hover:text-amber-400 transition uppercase tracking-tighter text-xs text-left">
            Predecir BTC →
          </span>
        </Link>

        {/* Predicción SOL */}
        <Link href="/predicciones?asset=SOL" className="card border-l-4 border-purple-500 hover:bg-slate-800/50 transition duration-300 group block text-left">
          <h2 className="mb-2 text-xl font-black text-white flex items-center gap-2 group-hover:text-purple-400 transition">
            <span className="text-purple-500">◎</span> SOL Predicción
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Pronostica el precio de Solana. Aprovecha la volatilidad para aumentar tu balance de freeboli.
          </p>
          <span className="mt-4 inline-block font-black text-purple-500 group-hover:text-purple-400 transition uppercase tracking-tighter text-xs">
            Predecir SOL →
          </span>
        </Link>

        {/* Predicción BOLIS */}
        <Link href="/predicciones?asset=BOLIS" className="card border-l-4 border-emerald-500 hover:bg-slate-800/50 transition duration-300 group block text-left">
          <h2 className="mb-2 text-xl font-black text-white flex items-center gap-2 group-hover:text-emerald-400 transition">
            <span className="text-emerald-500">B</span> BOLIS Predicción
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            El activo de la casa. Predice el movimiento de BOLIS/SOL y retira tus ganancias directamente.
          </p>
          <span className="mt-4 inline-block font-black text-emerald-500 group-hover:text-emerald-400 transition uppercase tracking-tighter text-xs">
            Predecir BOLIS →
          </span>
        </Link>

        {/* Faucet */}
        <Link href="/faucet" className="card border-l-4 border-slate-400 hover:bg-slate-800/50 transition duration-300 group block text-left">
          <h2 className="mb-2 text-xl font-black text-white group-hover:text-slate-300 transition">
            Faucet gratis
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Reclama puntos cada hora sin invertir. Acumula y convierte en BOLIS de Solana de forma segura.
          </p>
          <span className="mt-4 inline-block font-black text-slate-300 group-hover:text-white transition uppercase tracking-tighter text-xs">
            Ir al faucet →
          </span>
        </Link>

        {/* HI-LO */}
        <Link href="/hi-lo" className="card border-l-4 border-slate-500 hover:bg-slate-800/50 transition duration-300 group block text-left">
          <h2 className="mb-2 text-xl font-black text-white group-hover:text-slate-300 transition">
            Multiplicador HI-LO
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Apuesta puntos y multiplica. Sistema Provably Fair para garantizar transparencia total en cada jugada.
          </p>
          <span className="mt-4 inline-block font-black text-slate-300 group-hover:text-white transition uppercase tracking-tighter text-xs">
            Jugar HI-LO →
          </span>
        </Link>

        {/* Afiliados */}
        <Link href="/afiliados" className="card border-l-4 border-amber-600/50 hover:bg-slate-800/50 transition duration-300 group block text-left">
          <h2 className="mb-2 text-xl font-black text-white group-hover:text-amber-500 transition">
            Programa de Afiliados
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Invita amigos y gana comisión de por vida (5%+) sobre todos sus reclamos y jugadas en la plataforma.
          </p>
          <span className="mt-4 inline-block font-black text-slate-300 group-hover:text-white transition uppercase tracking-tighter text-xs">
            Ver programa →
          </span>
        </Link>
      </section>

      <section className="card max-w-2xl mx-auto text-center border-t border-slate-800 bg-slate-900/50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="mb-2 text-3xl font-black text-white tracking-tight">
          Depósitos y retiros en BOLIS
        </h2>
        <p className="text-slate-400 font-medium">
          Añade puntos enviando BOLIS a nuestra wallet. Cuando tengas suficientes
          puntos, retira BOLIS a tu wallet de Solana (Phantom, etc.).
        </p>
        <p className="mt-4 text-sm font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 inline-block px-4 py-2 rounded-lg border border-amber-500/20">
          Equivalencia: {String(POINTS_PER_BOLIS)} puntos = 1 BOLIS
        </p>
      </section>
    </div>
  );
}
