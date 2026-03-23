"use client";

import { useEffect, useState } from "react";
import { LEVELS } from "@/lib/levels";
import { useLang } from "@/context/LangContext";
import LevelProgressCard from "@/components/LevelProgressCard";

interface Entry {
  rank: number;
  userId: string;
  name: string;
  totalEarned: number;
  level: { level: number; name: string; icon: string; color: string };
  isCurrentUser: boolean;
}

type Period = "day" | "week" | "month" | "all";

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
  const { lang, t } = useLang();
  const [period, setPeriod] = useState<Period>("all");
  const [top10, setTop10] = useState<Entry[]>([]);
  const [userSection, setUserSection] = useState<Entry[] | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [currentRank, setCurrentRank] = useState<number | null>(null);
  const [prizes, setPrizes] = useState<{ daily: number[]; weekly: number[]; monthly: number[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const PERIOD_LABELS: { value: Period; label: string }[] = [
    { value: "day", label: t("ranking.tab_day") },
    { value: "week", label: t("ranking.tab_week") },
    { value: "month", label: t("ranking.tab_month") },
    { value: "all", label: t("ranking.tab_all") },
  ];

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
    <div className="mx-auto max-w-2xl space-y-6 py-8 text-left">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t("ranking.title")}</h1>
        {currentRank && (
          <span className="rounded bg-slate-800 px-3 py-1.5 text-sm text-amber-400 font-mono">
            {t("ranking.user_position").replace("{0}", currentRank.toString())}
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
        <h3 className="text-sm font-semibold text-amber-400 mb-2">{t("ranking.prizes_title")}</h3>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
            <div className="text-lg">🏆</div>
            <div className="text-amber-400 font-bold">{t("ranking.prize_1st")}</div>
            <div className="text-slate-400 mt-1 space-y-0.5">
              <div>{t("ranking.prize_daily")}: {prizes ? prizes.daily[0]?.toLocaleString() : "—"} pts</div>
              <div>{t("ranking.prize_weekly")}: {prizes ? prizes.weekly[0]?.toLocaleString() : "—"} pts</div>
              <div>{t("ranking.prize_monthly")}: {prizes ? prizes.monthly[0]?.toLocaleString() : "—"} pts</div>
            </div>
          </div>
          <div className="rounded-lg bg-slate-700/50 border border-slate-600 p-2">
            <div className="text-lg">🥈</div>
            <div className="text-slate-300 font-bold">{t("ranking.prize_2nd")}</div>
            <div className="text-slate-400 mt-1 space-y-0.5">
              <div>{t("ranking.prize_daily")}: {prizes ? prizes.daily[1]?.toLocaleString() : "—"} pts</div>
              <div>{t("ranking.prize_weekly")}: {prizes ? prizes.weekly[1]?.toLocaleString() : "—"} pts</div>
              <div>{t("ranking.prize_monthly")}: {prizes ? prizes.monthly[1]?.toLocaleString() : "—"} pts</div>
            </div>
          </div>
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/30 p-2">
            <div className="text-lg">🥉</div>
            <div className="text-orange-400 font-bold">{t("ranking.prize_3rd")}</div>
            <div className="text-slate-400 mt-1 space-y-0.5">
              <div>{t("ranking.prize_daily")}: {prizes ? prizes.daily[2]?.toLocaleString() : "—"} pts</div>
              <div>{t("ranking.prize_weekly")}: {prizes ? prizes.weekly[2]?.toLocaleString() : "—"} pts</div>
              <div>{t("ranking.prize_monthly")}: {prizes ? prizes.monthly[2]?.toLocaleString() : "—"} pts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-bold uppercase">{t("ranking.loading")}</div>
        ) : top10.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <p className="font-bold">{t("ranking.no_data")}</p>
            <p className="text-xs">
              {t("ranking.no_data_hint")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="p-3 w-12">{t("ranking.th_rank")}</th>
                  <th className="p-3">{t("ranking.th_player")}</th>
                  <th className="p-3 text-center">{t("ranking.th_level")}</th>
                  <th className="p-3 text-right">{t("ranking.th_points")}</th>
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
                        <span className="ml-1.5 text-[10px] uppercase tracking-wider text-amber-400/70">{t("ranking.user_tag")}</span>
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
                <div className="px-3 py-2 text-center text-xs text-slate-500 bg-slate-800/20">
                  {t("ranking.more_players").replace("{0}", (totalPlayers - 10).toString())}
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {userSection.map((e) => (
                      <tr
                        key={e.userId}
                        className={`border-b border-slate-700/50 ${
                          e.isCurrentUser ? "bg-amber-500/10" : "hover:bg-slate-800/50 transition"
                        }`}
                      >
                        <td className="p-3 w-12 text-slate-400">#{e.rank}</td>
                        <td className="p-3">
                          <span className={e.isCurrentUser ? "text-amber-400 font-semibold" : "text-white"}>
                            {e.name}
                          </span>
                          {e.isCurrentUser && (
                            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-amber-400/70">{t("ranking.user_tag")}</span>
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

      <p className="text-xs text-center text-slate-500 font-semibold uppercase tracking-widest">
        {t("ranking.total_players").replace("{0}", totalPlayers.toLocaleString())}
      </p>

      {/* Mi Nivel - Widget personal del jugador */}
      <LevelProgressCard />

      {/* Levels info - Tabla global de requisitos */}
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-amber-400">{t("ranking.levels_title")}</h2>
        <p className="text-xs text-slate-400">{t("ranking.levels_subtitle")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700 text-left">
                <th className="p-2">{t("ranking.th_lvl_name")}</th>
                <th className="p-2 text-center">{t("ranking.th_lvl_bets")}</th>
                <th className="p-2 text-center">{t("ranking.th_lvl_faucet")}</th>
                <th className="p-2 text-center">{t("ranking.th_lvl_preds")}</th>
                <th className="p-2 text-center">{t("ranking.th_lvl_days")}</th>
                <th className="p-2 text-center text-emerald-400">Retiro Máx.</th>
                <th className="p-2 text-center">{t("ranking.th_lvl_reward")}</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((l) => (
                <tr key={l.level} className="border-b border-slate-700/50 hover:bg-slate-800/30 transition">
                  <td className="p-2 text-left">
                    <span className={`${l.color} font-bold`}>{l.icon} {l.name}</span>
                  </td>
                  <td className="p-2 text-center text-slate-300 font-mono">{l.minBets > 0 ? l.minBets.toLocaleString() : "-"}</td>
                  <td className="p-2 text-center text-slate-300 font-mono">{l.minFaucet > 0 ? l.minFaucet.toLocaleString() : "-"}</td>
                  <td className="p-2 text-center text-slate-300 font-mono">{l.minPredictions > 0 ? l.minPredictions.toLocaleString() : "-"}</td>
                  <td className="p-2 text-center text-slate-300 font-mono">{l.minDaysSinceJoined > 0 ? `${l.minDaysSinceJoined}d` : "-"}</td>
                  <td className="p-2 text-center text-emerald-400 font-mono font-bold">
                    {l.benefits.maxWithdrawBolis > 0 ? `${(l.benefits.maxWithdrawBolis * 1000).toLocaleString()} pts` : "—"}
                  </td>
                  <td className="p-2 text-center text-amber-400 font-mono font-bold">
                    {l.rewardPoints > 0 ? `+${l.rewardPoints.toLocaleString()}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
