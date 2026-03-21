"use client";

import { useEffect, useState } from "react";
import { runAwardPrizesFromAdmin } from "../manual-cron-actions";

interface PrizeAward {
  id: string;
  userId: string;
  email: string;
  period: string;
  periodKey: string;
  rank: number;
  points: number;
  createdAt: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalEarned: number;
  level: { icon: string; name: string; color: string };
}

export default function AdminRankingPage() {
  const [awards, setAwards] = useState<PrizeAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<{ daily: LeaderboardEntry[]; weekly: LeaderboardEntry[]; monthly: LeaderboardEntry[] }>({ daily: [], weekly: [], monthly: [] });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/prize-awards").then((r) => r.json()),
      fetch("/api/leaderboard?period=day").then((r) => r.json()),
      fetch("/api/leaderboard?period=week").then((r) => r.json()),
      fetch("/api/leaderboard?period=month").then((r) => r.json()),
    ])
      .then(([awardsData, daily, weekly, monthly]) => {
        setAwards(awardsData.awards ?? []);
        setCurrent({
          daily: (daily.top10 ?? []).slice(0, 3),
          weekly: (weekly.top10 ?? []).slice(0, 3),
          monthly: (monthly.top10 ?? []).slice(0, 3),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function triggerPrizes() {
    const result = await runAwardPrizesFromAdmin();
    if (!result.ok) {
      alert(result.error);
      return;
    }
    const data = result.data;
    alert(JSON.stringify(data.results ?? data, null, 2));
    window.location.reload();
  }

  const RANK_MEDAL: Record<number, string> = { 1: "🏆", 2: "🥈", 3: "🥉" };

  if (loading) return <p className="text-slate-400">Cargando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Ranking y Premios</h2>
        <button onClick={triggerPrizes} className="btn-primary text-sm">
          Otorgar premios ahora
        </button>
      </div>

      {/* Current top 3 for each period */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <div key={p} className="card">
            <h3 className="text-sm font-semibold text-amber-400 mb-2 capitalize">
              Top 3 {p === "daily" ? "Hoy" : p === "weekly" ? "Esta semana" : "Este mes"}
            </h3>
            {current[p].length === 0 ? (
              <p className="text-xs text-slate-500">Sin datos</p>
            ) : (
              <div className="space-y-1">
                {current[p].map((e) => (
                  <div key={e.userId} className="flex items-center justify-between text-xs">
                    <span>
                      <span className="mr-1">{RANK_MEDAL[e.rank] ?? `#${e.rank}`}</span>
                      <span className={e.level.color}>{e.level.icon}</span>{" "}
                      <span className="text-slate-300">{e.name}</span>
                    </span>
                    <span className="font-mono text-amber-400">{e.totalEarned.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Prize history */}
      <div className="card">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Historial de premios otorgados</h3>
        {awards.length === 0 ? (
          <p className="text-xs text-slate-500">Sin premios otorgados aun</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-left">Periodo</th>
                  <th className="p-2 text-center">Puesto</th>
                  <th className="p-2 text-left">Usuario</th>
                  <th className="p-2 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {awards.map((a) => (
                  <tr key={a.id} className="border-b border-slate-700/50">
                    <td className="p-2 text-slate-400">{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td className="p-2 text-slate-300">{a.period} ({a.periodKey})</td>
                    <td className="p-2 text-center">{RANK_MEDAL[a.rank] ?? `#${a.rank}`}</td>
                    <td className="p-2 text-slate-300">{a.email}</td>
                    <td className="p-2 text-right font-mono text-amber-400">{a.points.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
