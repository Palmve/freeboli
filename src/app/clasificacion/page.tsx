"use client";

import { useEffect, useState } from "react";
import { LEVELS } from "@/lib/levels";

interface Entry {
  rank: number;
  userId: string;
  name: string;
  totalEarned: number;
  level: { level: number; name: string; icon: string; color: string };
  isCurrentUser: boolean;
}

type Period = "day" | "week" | "month" | "all";

const PERIOD_LABELS: { value: Period; label: string }[] = [
  { value: "day", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "all", label: "Todos" },
];

const RANK_STYLE: Record<number, string> = {
  1: "text-amber-400 font-bold text-lg",
  2: "text-slate-300 font-bold",
  3: "text-orange-400 font-bold",
};

const RANK_MEDAL: Record<number, string> = {
  1: "🏆",
  2: "🥈",
  3: "🥉",
};

export default function ClasificacionPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [top10, setTop10] = useState<Entry[]>([]);
  const [userSection, setUserSection] = useState<Entry[] | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [currentRank, setCurrentRank] = useState<number | null>(null);
  const [prizes, setPrizes] = useState<{ daily: number[]; weekly: number[]; monthly: number[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setTop10(d.top10 ?? []);
        setUserSection(d.userSection ?? null);
        setTotalPlayers(d.totalPlayers ?? 0);
        setCurrentRank(d.currentUserRank ?? null);
        if (d.prizes) setPrizes(d.prizes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Tabla de Clasificacion</h1>
        {currentRank && (
          <span className="rounded bg-slate-800 px-3 py-1.5 text-sm text-amber-400 font-mono">
            Tu posicion: #{currentRank}
          </span>
        )}
      </div>

      {/* Period selector */}
      <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
        {PERIOD_LABELS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              period === p.value
                ? "bg-amber-500 text-slate-900"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Prize info */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-amber-400 mb-2">Premios para los Top 3</h3>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
            <div className="text-lg">🏆</div>
            <div className="text-amber-400 font-bold">1er lugar</div>
            <div className="text-slate-400 mt-1 space-y-0.5">
              <div>Diario: {prizes ? prizes.daily[0]?.toLocaleString() : "—"} pts</div>
              <div>Semanal: {prizes ? prizes.weekly[0]?.toLocaleString() : "—"} pts</div>
              <div>Mensual: {prizes ? prizes.monthly[0]?.toLocaleString() : "—"} pts</div>
            </div>
          </div>
          <div className="rounded-lg bg-slate-700/50 border border-slate-600 p-2">
            <div className="text-lg">🥈</div>
            <div className="text-slate-300 font-bold">2do lugar</div>
            <div className="text-slate-400 mt-1 space-y-0.5">
              <div>Diario: {prizes ? prizes.daily[1]?.toLocaleString() : "—"} pts</div>
              <div>Semanal: {prizes ? prizes.weekly[1]?.toLocaleString() : "—"} pts</div>
              <div>Mensual: {prizes ? prizes.monthly[1]?.toLocaleString() : "—"} pts</div>
            </div>
          </div>
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/30 p-2">
            <div className="text-lg">🥉</div>
            <div className="text-orange-400 font-bold">3er lugar</div>
            <div className="text-slate-400 mt-1 space-y-0.5">
              <div>Diario: {prizes ? prizes.daily[2]?.toLocaleString() : "—"} pts</div>
              <div>Semanal: {prizes ? prizes.weekly[2]?.toLocaleString() : "—"} pts</div>
              <div>Mensual: {prizes ? prizes.monthly[2]?.toLocaleString() : "—"} pts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : top10.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <p>Sin datos para este periodo.</p>
            <p className="text-xs">
              La tabla se llena con puntos ganados en Faucet, HI-LO, logros y recompensas. Prueba con &quot;Todos&quot; o asegurate de tener movimientos en la base de datos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="p-3 w-12">#</th>
                  <th className="p-3">Jugador</th>
                  <th className="p-3 text-center">Nivel</th>
                  <th className="p-3 text-right">Puntos ganados</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((e) => (
                  <tr
                    key={e.userId}
                    className={`border-b border-slate-700/50 transition ${
                      e.isCurrentUser ? "bg-amber-500/10" : "hover:bg-slate-800/50"
                    }`}
                  >
                    <td className={`p-3 ${RANK_STYLE[e.rank] ?? "text-slate-400"}`}>
                      {RANK_MEDAL[e.rank] ?? `#${e.rank}`}
                    </td>
                    <td className="p-3">
                      <span className={e.isCurrentUser ? "text-amber-400 font-semibold" : "text-white"}>
                        {e.name}
                      </span>
                      {e.isCurrentUser && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wider text-amber-400/70">(Tu)</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={e.level.color} title={e.level.name}>
                        {e.level.icon}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-amber-400">
                      {e.totalEarned.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* User section if beyond top 10 */}
            {userSection && (
              <>
                <div className="px-3 py-2 text-center text-xs text-slate-500">
                  ··· {totalPlayers - 10} jugadores mas ···
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {userSection.map((e) => (
                      <tr
                        key={e.userId}
                        className={`border-b border-slate-700/50 ${
                          e.isCurrentUser ? "bg-amber-500/10" : ""
                        }`}
                      >
                        <td className="p-3 w-12 text-slate-400">#{e.rank}</td>
                        <td className="p-3">
                          <span className={e.isCurrentUser ? "text-amber-400 font-semibold" : "text-white"}>
                            {e.name}
                          </span>
                          {e.isCurrentUser && (
                            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-amber-400/70">(Tu)</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={e.level.color} title={e.level.name}>
                            {e.level.icon}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-amber-400">
                          {e.totalEarned.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-center text-slate-500">
        {totalPlayers} jugadores en total
      </p>

      {/* Levels info */}
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-amber-400">Niveles de usuario</h2>
        <p className="text-xs text-slate-400">Sube de nivel cumpliendo los requisitos:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="p-2 text-left">Nivel</th>
                <th className="p-2 text-center">Apuestas</th>
                <th className="p-2 text-center">Faucet</th>
                <th className="p-2 text-center">Referidos</th>
                <th className="p-2 text-center">Email</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((l) => (
                <tr key={l.level} className="border-b border-slate-700/50">
                  <td className="p-2">
                    <span className={`${l.color} font-medium`}>
                      {l.icon} {l.name}
                    </span>
                  </td>
                  <td className="p-2 text-center text-slate-300">{l.minBets > 0 ? l.minBets.toLocaleString() : "-"}</td>
                  <td className="p-2 text-center text-slate-300">{l.minFaucet > 0 ? l.minFaucet.toLocaleString() : "-"}</td>
                  <td className="p-2 text-center text-slate-300">{l.minReferrals > 0 ? l.minReferrals : "-"}</td>
                  <td className="p-2 text-center">{l.requiresEmail ? "Si" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
