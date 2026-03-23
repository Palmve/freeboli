export interface UserLevel {
  level: number;
  name: string;
  icon: string;
  color: string;
  glow: string;       // Clase CSS de resplandor para el widget
  minBets: number;
  minFaucet: number;
  minPredictions: number;
  minDaysSinceJoined: number; // Días desde la inscripción (NO consecutivos)
  requiresEmail: boolean;
  rewardPoints: number;
  benefits: {
    maxBetPoints: number;
    maxWithdrawBolis: number;
  };
}

export const LEVELS: UserLevel[] = [
  { 
    level: 1, name: "Novato", icon: "🥉", color: "text-slate-400", glow: "shadow-slate-500/30",
    minBets: 0, minFaucet: 0, minPredictions: 0, minDaysSinceJoined: 0, requiresEmail: false,
    rewardPoints: 0,
    benefits: { maxBetPoints: 10000, maxWithdrawBolis: 0 }
  },
  { 
    level: 2, name: "Aprendiz", icon: "🥈", color: "text-sky-400", glow: "shadow-sky-500/40",
    minBets: 5, minFaucet: 3, minPredictions: 0, minDaysSinceJoined: 0, requiresEmail: true,
    rewardPoints: 0,
    benefits: { maxBetPoints: 25000, maxWithdrawBolis: 0 }
  },
  { 
    level: 3, name: "Jugador", icon: "🥇", color: "text-blue-400", glow: "shadow-blue-500/40",
    minBets: 20, minFaucet: 10, minPredictions: 0, minDaysSinceJoined: 1, requiresEmail: true,
    rewardPoints: 0,
    benefits: { maxBetPoints: 50000, maxWithdrawBolis: 10 }
  },
  { 
    level: 4, name: "Veterano", icon: "⭐", color: "text-purple-400", glow: "shadow-purple-500/50",
    minBets: 200, minFaucet: 30, minPredictions: 10, minDaysSinceJoined: 7, requiresEmail: true,
    rewardPoints: 1000,
    benefits: { maxBetPoints: 100000, maxWithdrawBolis: 25 }
  },
  { 
    level: 5, name: "Experto", icon: "💎", color: "text-emerald-400", glow: "shadow-emerald-500/50",
    minBets: 1000, minFaucet: 60, minPredictions: 50, minDaysSinceJoined: 30, requiresEmail: true,
    rewardPoints: 5000,
    benefits: { maxBetPoints: 250000, maxWithdrawBolis: 50 }
  },
  { 
    level: 6, name: "Maestro", icon: "👑", color: "text-amber-400", glow: "shadow-amber-500/50",
    minBets: 5000, minFaucet: 100, minPredictions: 150, minDaysSinceJoined: 90, requiresEmail: true,
    rewardPoints: 25000,
    benefits: { maxBetPoints: 500000, maxWithdrawBolis: 100 }
  },
  { 
    level: 7, name: "Leyenda", icon: "🔥", color: "text-red-400", glow: "shadow-red-500/60",
    minBets: 10000, minFaucet: 200, minPredictions: 400, minDaysSinceJoined: 180, requiresEmail: true,
    rewardPoints: 100000,
    benefits: { maxBetPoints: 1000000, maxWithdrawBolis: 250 }
  },
];

export function getUserLevel(stats: {
  betCount: number;
  faucetClaims: number;
  predictionCount: number;
  daysSinceJoined: number;    // Días desde la inscripción
  emailVerified: boolean;
}): UserLevel {
  let result = LEVELS[0];
  for (const lvl of LEVELS) {
    if (lvl.requiresEmail && !stats.emailVerified) continue;
    if (
      stats.betCount >= lvl.minBets && 
      stats.faucetClaims >= lvl.minFaucet && 
      stats.predictionCount >= (lvl.minPredictions ?? 0) &&
      stats.daysSinceJoined >= (lvl.minDaysSinceJoined ?? 0)
    ) {
      result = lvl;
    }
  }
  return result;
}

export function getNextLevel(current: UserLevel): UserLevel | null {
  const idx = LEVELS.findIndex((l) => l.level === current.level);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export function getLevelProgress(stats: {
  betCount: number;
  faucetClaims: number;
  predictionCount: number;
  daysSinceJoined: number;
  emailVerified: boolean;
}, target: UserLevel): { bets: number; faucet: number; predictions: number; days: number; email: boolean } {
  return {
    bets: Math.min(stats.betCount / Math.max(target.minBets, 1), 1),
    faucet: Math.min(stats.faucetClaims / Math.max(target.minFaucet, 1), 1),
    predictions: Math.min(stats.predictionCount / Math.max(target.minPredictions, 1), 1),
    days: Math.min(stats.daysSinceJoined / Math.max(target.minDaysSinceJoined, 1), 1),
    email: !target.requiresEmail || stats.emailVerified,
  };
}

/** Obtiene el nivel de un usuario desde la BD (usando contadores cacheados en profile). */
export async function fetchUserLevel(supabase: any, userId: string): Promise<UserLevel> {
  const { data: p } = await supabase
    .from("profiles")
    .select("hilo_bet_count, faucet_claim_count, prediction_count, email_verified_at, created_at")
    .eq("id", userId)
    .single();

  if (!p) return LEVELS[0];

  const daysSinceJoined = p.created_at
    ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
    : 0;

  return getUserLevel({
    betCount: p.hilo_bet_count ?? 0,
    faucetClaims: p.faucet_claim_count ?? 0,
    predictionCount: p.prediction_count ?? 0,
    daysSinceJoined,
    emailVerified: !!p.email_verified_at,
  });
}

/** 
 * Verifica si el usuario ha subido de nivel y envía una notificación por correo 
 * si el nivel actual es mayor al último notificado.
 */
export async function checkAndNotifyLevelUp(supabase: any, userId: string, email: string, name?: string) {
  const { data: p } = await supabase
    .from("profiles")
    .select("last_notified_level")
    .eq("id", userId)
    .single();

  const currentLevel = await fetchUserLevel(supabase, userId);
  const lastLevel = p?.last_notified_level ?? 1;

  if (currentLevel.level > lastLevel) {
    const { sendEmailViaResend } = await import("./resend");
    const { getLevelUpEmail } = await import("./mail-templates");

    const benefitsMap: string[] = [
      `Límite de apuesta aumentado a <strong>${currentLevel.benefits.maxBetPoints.toLocaleString()}</strong> puntos.`,
      `Límite de retiro aumentado a <strong>${currentLevel.benefits.maxWithdrawBolis} BOLIS</strong>.`
    ];

    if (currentLevel.level >= 4) { // Veterano+
      benefitsMap.push("Acceso prioritario a nuevas funciones de casino.");
    }

    // Acreditar recompensa en puntos si existe
    if (currentLevel.rewardPoints > 0) {
        try {
            await supabase.rpc("atomic_add_points", {
                target_user_id: userId,
                amount_to_add: currentLevel.rewardPoints
            });

            await supabase.from("movements").insert({
                user_id: userId,
                type: "recompensa",
                points: currentLevel.rewardPoints,
                reference: `level_up_${currentLevel.level}`,
                metadata: { level: currentLevel.level, levelName: currentLevel.name, source: "level_up_reward" }
            });

            benefitsMap.push(`Premio por ascenso: <strong>+${currentLevel.rewardPoints.toLocaleString()}</strong> puntos acreditados.`);
        } catch (rewErr) {
            console.error("[LevelUp] Error acreditando recompensa:", rewErr);
        }
    }

    try {
      const { getLevelCardEmail } = await import("./mail-templates");
      const nextLvl = getNextLevel(currentLevel);

      await sendEmailViaResend({
        to: email,
        subject: `${currentLevel.icon} ¡Subiste al nivel ${currentLevel.name} en FreeBoli!`,
        html: getLevelCardEmail({
          userName: name || email.split('@')[0],
          levelLevel: currentLevel.level,
          levelName: currentLevel.name,
          levelIcon: currentLevel.icon,
          xpPercent: nextLvl ? 5 : 100, // Al subir de nivel empezamos en el inicio del siguiente
          maxBetPoints: currentLevel.benefits.maxBetPoints,
          maxWithdrawBolis: currentLevel.benefits.maxWithdrawBolis,
          rewardPoints: currentLevel.rewardPoints,
          nextLevelName: nextLvl?.name,
          nextLevelIcon: nextLvl?.icon,
          benefits: benefitsMap,
        })
      });

      // Actualizar el último nivel notificado para evitar correos duplicados
      await supabase
        .from("profiles")
        .update({ last_notified_level: currentLevel.level })
        .eq("id", userId);
      
      console.log(`[LevelUp] Email enviado a ${email} por subir al nivel ${currentLevel.level}`);
    } catch (err) {
      console.error("[LevelUp] Error enviando email:", err);
    }
  }
}
