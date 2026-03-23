"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { POINTS_PER_BOLIS } from "@/lib/config";
import { useLang } from "@/context/LangContext";
import LevelProgressCard from "@/components/LevelProgressCard";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

// Metas diarias (misiones motivacionales)
const MISSIONS = [
  { icon: "🚰", label: "Reclama el Faucet", desc: "Cada hora, puntos gratis → Sube tu nivel", href: "/faucet", color: "from-blue-600 to-cyan-500", border: "border-cyan-500/40", glow: "hover:shadow-cyan-500/20" },
  { icon: "📈", label: "Predice el mercado", desc: "Acierta la dirección y multiplica tus puntos", href: "/predicciones", color: "from-amber-600 to-yellow-400", border: "border-amber-500/40", glow: "hover:shadow-amber-500/20" },
  { icon: "🎲", label: "Juega HI-LO", desc: "Apuesta y multiplica. Provably Fair.", href: "/hi-lo", color: "from-purple-600 to-pink-500", border: "border-purple-500/40", glow: "hover:shadow-purple-500/20" },
  { icon: "🏆", label: "Sube al top del ranking", desc: "Compite con otros jugadores por premios diarios", href: "/clasificacion", color: "from-emerald-600 to-teal-400", border: "border-emerald-500/40", glow: "hover:shadow-emerald-500/20" },
];

// Función utilitaria para formatear números consistentemente en servidor y cliente
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

// Barra de stats de juego animada
function StatBar({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/30 transition group">
      <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-2xl font-black text-white">{value}</span>
      <span className="text-xs text-slate-500 mt-0.5">{label}</span>
    </div>
  );
}

// Tarjeta de juego tipo arcade
function GameCard({ icon, label, desc, href, color, border, glow }: typeof MISSIONS[0]) {
  return (
    <Link href={href}
      className={`group relative overflow-hidden rounded-2xl border ${border} bg-slate-900 p-5 flex flex-col gap-3 transition-all duration-300 hover:shadow-xl ${glow} hover:-translate-y-1 active:translate-y-0`}
    >
      {/* Fondo degradado neón en hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

      <div className="relative flex items-start gap-3">
        {/* Icono con glow */}
        <span className={`text-3xl p-2 rounded-xl bg-gradient-to-br ${color} bg-opacity-20 shadow-lg`}>{icon}</span>
        <div className="flex-1">
          <div className="font-black text-white text-base group-hover:text-amber-300 transition">{label}</div>
          <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</div>
        </div>
        <span className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all text-xl mt-1">→</span>
      </div>

      {/* Barra de "energía" decorativa */}
      <div className="relative h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full group-hover:w-full w-2/3 transition-all duration-700`} />
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const { t } = useLang();
  const loggedIn = !!session?.user || !REQUIRE_AUTH;
  const loading = REQUIRE_AUTH && status === "loading";
  const [tick, setTick] = useState(0);

  // Estadísticas (dentro del componente para que t() funcione correctamente)
  const PLATFORM_STATS = [
    { value: fmt(POINTS_PER_BOLIS), label: t("home.stat_points_label") || "Puntos = 1 BOLIS", icon: "💎" },
    { value: "7", label: t("home.stat_levels_label") || "Niveles de Jugador", icon: "🏅" },
    { value: "+100K", label: t("home.stat_prize_label") || "Puntos de Premio en Leyenda", icon: "🔥" },
    { value: "24h", label: t("home.stat_ranking_label") || "Recompensas Ranking", icon: "⏱️" },
  ];

  // Animación del contador del hero
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-12 py-6 px-2">

      {/* ═══════════════════════════════════════
          HERO - Gaming Banner                  
      ═══════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-2xl px-6 py-14 text-center">
        {/* Aura de fondo animada */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/5 rounded-full blur-2xl" />
        </div>

        {/* Badge de plataforma */}
        <div className="relative mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest">
          <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          FreeBoli — Gana, Juega, Retira en Solana
        </div>

        {/* Título hero */}
        <h1 className="relative mb-4 text-5xl font-black tracking-tighter text-white md:text-7xl drop-shadow-2xl leading-none">
          {t("home.title")}
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">
            en BOLIS 🔥
          </span>
        </h1>

        <p className="relative mx-auto max-w-xl text-base text-slate-400 font-medium mb-8">
          {t("home.subtitle")}
        </p>

        {/* CTA Buttons */}
        <div className="relative flex flex-wrap justify-center gap-3">
          {loading ? (
            <div className="h-16" />
          ) : loggedIn ? (
            <>
              <Link href="/faucet"
                className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black rounded-2xl text-base px-7 py-3.5 hover:opacity-90 transition shadow-xl shadow-blue-600/20 hover:-translate-y-0.5 active:translate-y-0"
              >
                🚰 {t("home.btn_faucet")}
              </Link>
              <Link href="/predicciones"
                className="group flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-2xl text-base px-7 py-3.5 hover:opacity-90 transition shadow-xl shadow-amber-500/20 hover:-translate-y-0.5 active:translate-y-0"
              >
                📈 {t("home.btn_prediction")}
              </Link>
              <Link href="/hi-lo"
                className="group flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-black rounded-2xl text-base px-7 py-3.5 hover:opacity-90 transition shadow-xl shadow-purple-600/20 hover:-translate-y-0.5 active:translate-y-0"
              >
                🎲 {t("home.btn_hilo")}
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/registro"
                className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-2xl text-lg px-10 py-4 hover:opacity-90 transition shadow-xl shadow-amber-500/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                {t("home.btn_play_now")} 🚀
              </Link>
              <Link href="/auth/login"
                className="bg-slate-800 border border-slate-700 text-white font-black rounded-2xl text-lg px-10 py-4 hover:bg-slate-700 transition shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              >
                {t("home.btn_login")}
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STATS DE LA PLATAFORMA               
      ═══════════════════════════════════════ */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PLATFORM_STATS.map((s) => (
          <StatBar key={s.label} {...s} />
        ))}
      </section>

      {/* ═══════════════════════════════════════
          WIDGET DE NIVEL (sólo logueados)     
      ═══════════════════════════════════════ */}
      {loggedIn && !loading && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">🎮</span>
            <h2 className="text-base font-black text-slate-300 uppercase tracking-widest">Tu Progreso de Jugador</h2>
          </div>
          <LevelProgressCard />
        </section>
      )}

      {/* ═══════════════════════════════════════
          MISIONES / METAS DEL DÍA             
      ═══════════════════════════════════════ */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <h2 className="text-base font-black text-slate-300 uppercase tracking-widest">Misiones del Día</h2>
          </div>
          <span className="text-xs text-slate-600 font-mono">Completa para subir de nivel</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MISSIONS.map((m) => (
            <GameCard key={m.href} {...m} />
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          ÁRBOL DE NIVELES - MOTIVACIÓN         
      ═══════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6">
        <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />

        <div className="mb-5 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest mb-3">Sistema de Rangos</span>
          <h2 className="text-2xl font-black text-white">Sube de nivel. Desbloquea más poder.</h2>
          <p className="text-sm text-slate-500 mt-1">Cada rango te da mayores límites y premios en puntos</p>
        </div>

        {/* Barra visual de progresión de rangos */}
        <div className="flex items-start justify-between gap-0 pt-4 overflow-x-auto pb-2 px-1">
          {[
            { icon: "🥉", name: "Novato",   color: "text-slate-400",   bg: "bg-slate-800",      ring: "ring-slate-500" },
            { icon: "🥈", name: "Aprendiz", color: "text-sky-400",     bg: "bg-sky-900/40",     ring: "ring-sky-500" },
            { icon: "🥇", name: "Jugador",  color: "text-blue-400",    bg: "bg-blue-900/40",    ring: "ring-blue-500" },
            { icon: "⭐", name: "Veterano", color: "text-purple-400",  bg: "bg-purple-900/40",  ring: "ring-purple-500" },
            { icon: "💎", name: "Experto",  color: "text-emerald-400", bg: "bg-emerald-900/40", ring: "ring-emerald-500" },
            { icon: "👑", name: "Maestro",  color: "text-amber-400",   bg: "bg-amber-900/40",   ring: "ring-amber-500" },
            { icon: "🔥", name: "Leyenda",  color: "text-red-400",     bg: "bg-red-900/40",     ring: "ring-red-500" },
          ].map((lvl, i, arr) => (
            <div key={lvl.name} className="flex items-center flex-1 min-w-0">
              {/* Nodo del nivel */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${lvl.bg} ring-2 ${lvl.ring} flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-black/30`}>
                  {lvl.icon}
                </div>
                <span className={`text-[9px] sm:text-[11px] font-black ${lvl.color} text-center whitespace-nowrap`}>{lvl.name}</span>
              </div>
              {/* Conector — solo entre nodos, no al final */}
              {i < arr.length - 1 && (
                <div className="flex-1 h-[2px] bg-gradient-to-r from-slate-600 to-slate-700 mx-1 sm:mx-2 mb-5" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-xl bg-slate-800/50 border border-slate-700 px-4 py-3">
            <div className="text-amber-400 font-black text-lg">+1,000 pts</div>
            <div className="text-slate-500 text-xs">Premio al ser Veterano ⭐</div>
          </div>
          <div className="rounded-xl bg-slate-800/50 border border-slate-700 px-4 py-3">
            <div className="text-emerald-400 font-black text-lg">+25,000 pts</div>
            <div className="text-slate-500 text-xs">Premio al ser Maestro 👑</div>
          </div>
          <div className="rounded-xl bg-red-900/20 border border-red-800/30 px-4 py-3">
            <div className="text-red-400 font-black text-lg">+100,000 pts</div>
            <div className="text-slate-500 text-xs">Premio al ser Leyenda 🔥</div>
          </div>
        </div>

        <div className="mt-5 text-center">
          <Link href="/clasificacion"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition text-sm"
          >
            Ver tabla de clasificación → 🏆
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECCIÓN BOLIS / CONVERSIÓN           
      ═══════════════════════════════════════ */}
      <section className="rounded-3xl overflow-hidden relative bg-gradient-to-r from-emerald-950 to-slate-950 border border-emerald-900/40 p-6 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(52,211,153,0.08),transparent_60%)]" />
        <h2 className="text-2xl font-black text-white relative mb-1">{t("home.footer_title")}</h2>
        <p className="text-slate-400 text-sm relative mb-4">{t("home.footer_desc")}</p>
        <div className="relative inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-2xl">💎</span>
          <span className="text-emerald-400 font-black text-lg">{String(POINTS_PER_BOLIS)} {t("home.rate_prefix")}</span>
        </div>
        {!loggedIn && !loading && (
          <div className="relative mt-6">
            <Link href="/auth/registro"
              className="inline-block px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition shadow-xl shadow-emerald-500/20"
            >
              Empezar gratis →
            </Link>
          </div>
        )}
      </section>

    </div>
  );
}
