"use client";

import { useEffect, useState } from "react";
import { LEVELS, UserLevel } from "@/lib/levels";
import { useLang } from "@/context/LangContext";

interface LevelStats {
  betCount: number;
  faucetClaims: number;
  predictionCount: number;
  daysSinceJoined: number;
  emailVerified: boolean;
  currentLevel: UserLevel;
  nextLevel: UserLevel | null;
  rewardPoints: number;
  maxBetPoints: number;
  maxWithdrawBolis: number;
  xpPercent: number; // 0-100 progreso global hacia el siguiente nivel
}

interface Props {
  compact?: boolean; // Modo pequeño (ej: en header o sidebar)
}

// Barra de progreso animada para una sola métrica
function MetricBar({ label, icon, value, max, pct }: { label: string; icon: string; value: number; max: number; pct: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(Math.round(pct * 100)), 100); }, [pct]);
  const color = pct >= 1 ? "bg-emerald-500" : pct >= 0.6 ? "bg-amber-400" : "bg-blue-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{icon} {label}</span>
        <span className={pct >= 1 ? "text-emerald-400 font-bold" : "text-slate-300"}>
          {value.toLocaleString()} / {max.toLocaleString()} {pct >= 1 && "✅"}
        </span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function LevelProgressCard({ compact = false }: Props) {
  const { t } = useLang();
  const [stats, setStats] = useState<LevelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [pulseLevel, setPulseLevel] = useState(false);

  useEffect(() => {
    fetch("/api/user/level-stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.currentLevel) {
          setStats(d);
          setPulseLevel(true);
          setTimeout(() => setPulseLevel(false), 2000);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-1/3 mb-2" />
        <div className="h-2 bg-slate-700 rounded w-full" />
        <p className="text-[10px] text-slate-500 mt-2">{t("account.loading")}</p>
      </div>
    );
  }

  if (!stats) return null;

  const { currentLevel, nextLevel, betCount, faucetClaims, predictionCount, daysSinceJoined, emailVerified, xpPercent } = stats;

  const GLOW_MAP: Record<number, string> = {
    1: "shadow-slate-500/30", 2: "shadow-sky-500/40", 3: "shadow-blue-500/40",
    4: "shadow-purple-500/50", 5: "shadow-emerald-500/50", 6: "shadow-amber-500/60", 7: "shadow-red-500/70",
  };
  const glow = GLOW_MAP[currentLevel.level] ?? "";

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 shadow-lg ${glow}`}>
        <span className="text-xl">{currentLevel.icon}</span>
        <div>
          <div className={`text-xs font-bold ${currentLevel.color}`}>{currentLevel.name}</div>
          <div className="h-1 w-16 bg-slate-700 rounded-full overflow-hidden mt-0.5">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-700" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
        <span className="text-[10px] text-slate-400 ml-1">{xpPercent}%</span>
      </div>
    );
  }

  return (
    <div className={`card p-4 space-y-4 shadow-lg ${glow} border border-slate-700`}>
      {/* Cabecera: Nivel actual */}
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-3 transition-all duration-500 ${pulseLevel ? "scale-110" : "scale-100"}`}
        >
          <span className="text-4xl drop-shadow-lg">{currentLevel.icon}</span>
          <div>
            <div className={`text-lg font-extrabold tracking-wide ${currentLevel.color}`}>
              {currentLevel.name}
            </div>
            <div className="text-xs text-slate-400">{t("levels.level_of", currentLevel.level, LEVELS.length)}</div>
          </div>
        </div>
        {currentLevel.level === LEVELS.length ? (
          <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 font-bold animate-pulse border border-red-500/30">
            🔥 {t("levels.max_level")}
          </span>
        ) : nextLevel && (
          <div className="text-right">
            <div className="text-xs text-slate-500">{t("levels.next_level")}</div>
            <div className={`text-sm font-bold ${nextLevel.color}`}>{nextLevel.icon} {nextLevel.name}</div>
          </div>
        )}
      </div>

      {/* Barra de XP global */}
      {nextLevel && (
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>{t("levels.progress_to")} <strong className={nextLevel.color}>{nextLevel.name}</strong></span>
            <span className="font-mono font-bold text-white">{xpPercent}%</span>
          </div>
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 transition-all duration-1000 ease-out relative"
              style={{ width: `${xpPercent}%` }}
            >
              {xpPercent > 10 && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold">
                  {xpPercent}%
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Beneficios actuales */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-2 text-center">
          <div className="text-slate-400 mb-0.5">{t("levels.max_bet")}</div>
          <div className="font-bold text-amber-400">{currentLevel.benefits.maxBetPoints.toLocaleString()} pts</div>
        </div>
        <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-2 text-center">
          <div className="text-slate-400 mb-0.5">{t("levels.max_withdraw")}</div>
          <div className="font-bold text-emerald-400">{currentLevel.benefits.maxWithdrawBolis} BOLIS</div>
        </div>
      </div>

      {/* Métricas de progreso (por defecto ocultas, expansibles) */}
      {nextLevel && (
        <>
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-xs text-slate-500 hover:text-slate-300 transition flex items-center justify-center gap-1 py-1"
          >
            {showAll ? `▲ ${t("levels.hide_details")}` : `▼ ${t("levels.view_requirements")}`}
          </button>
              {showAll && (
                <div className="space-y-2 pt-1 border-t border-slate-700/50">
                  {nextLevel.minBets > 0 && (
                    <MetricBar label={t("levels.metric_hilo")} icon="🎲" value={betCount} max={nextLevel.minBets} pct={Math.min(betCount / nextLevel.minBets, 1)} />
                  )}
                  {nextLevel.minFaucet > 0 && (
                    <MetricBar label={t("levels.metric_faucet")} icon="🚰" value={faucetClaims} max={nextLevel.minFaucet} pct={Math.min(faucetClaims / nextLevel.minFaucet, 1)} />
                  )}
                  {nextLevel.minPredictions > 0 && (
                    <MetricBar label={t("levels.metric_preds")} icon="📈" value={predictionCount} max={nextLevel.minPredictions} pct={Math.min(predictionCount / nextLevel.minPredictions, 1)} />
                  )}
                  {nextLevel.minDaysSinceJoined > 0 && (
                    <MetricBar label={t("levels.metric_days")} icon="📅" value={daysSinceJoined} max={nextLevel.minDaysSinceJoined} pct={Math.min(daysSinceJoined / nextLevel.minDaysSinceJoined, 1)} />
                  )}
                  {nextLevel.requiresEmail && !emailVerified && (
                    <div className="text-xs text-amber-400 flex items-center gap-1.5">
                      <span>📧</span> {t("levels.verify_email_hint")}
                    </div>
                  )}
                  {nextLevel.rewardPoints > 0 && (
                    <div className="text-xs text-emerald-400 flex items-center gap-1.5 mt-1">
                      🎁 {t("levels.level_up_reward", `+${nextLevel.rewardPoints.toLocaleString()} pts`)}
                    </div>
                  )}
                </div>
              )}
        </>
      )}
    </div>
  );
}
