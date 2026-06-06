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

/** Índice por `level` (1–7) → clave `home.rank_<slug>` en i18n */
export const LEVEL_RANK_SLUGS = [
  "novice",
  "apprentice",
  "player",
  "veteran",
  "expert",
  "master",
  "legend",
] as const;

export type LevelRankSlug = (typeof LEVEL_RANK_SLUGS)[number];

export function levelRankSlug(levelNumber: number): LevelRankSlug | undefined {
  const i = levelNumber - 1;
  if (i < 0 || i >= LEVEL_RANK_SLUGS.length) return undefined;
  return LEVEL_RANK_SLUGS[i];
}

/** Nombre de rango según idioma (fallback al `name` en español de LEVELS). */
export function translateLevelName(
  t: (key: string) => string,
  levelNumber: number,
  fallbackName: string
): string {
  const slug = levelRankSlug(levelNumber);
  if (!slug) return fallbackName;
  const key = `home.rank_${slug}`;
  const translated = t(key);
  return translated === key ? fallbackName : translated;
}

export const LEVELS: UserLevel[] = [
  { 
    level: 1, name: "Novato", icon: "🥉", color: "text-slate-400", glow: "shadow-slate-500/30",
    minBets: 0, minFaucet: 0, minPredictions: 0, minDaysSinceJoined: 0, requiresEmail: false,
    rewardPoints: 0,
    benefits: { maxBetPoints: 500, maxWithdrawBolis: 0 }
  },
  { 
    level: 2, name: "Aprendiz", icon: "🥈", color: "text-sky-400", glow: "shadow-sky-500/40",
    minBets: 5, minFaucet: 3, minPredictions: 0, minDaysSinceJoined: 0, requiresEmail: true,
    rewardPoints: 0,
    benefits: { maxBetPoints: 1000, maxWithdrawBolis: 0 }
  },
  { 
    level: 3, name: "Jugador", icon: "🥇", color: "text-blue-400", glow: "shadow-blue-500/40",
    minBets: 20, minFaucet: 10, minPredictions: 0, minDaysSinceJoined: 1, requiresEmail: true,
    rewardPoints: 0,
    benefits: { maxBetPoints: 2500, maxWithdrawBolis: 10 }
  },
  { 
    level: 4, name: "Veterano", icon: "⭐", color: "text-purple-400", glow: "shadow-purple-500/50",
    minBets: 200, minFaucet: 30, minPredictions: 10, minDaysSinceJoined: 3, requiresEmail: true,
    rewardPoints: 1000,
    benefits: { maxBetPoints: 5000, maxWithdrawBolis: 25 }
  },
  { 
    level: 5, name: "Experto", icon: "💎", color: "text-emerald-400", glow: "shadow-emerald-500/50",
    minBets: 1000, minFaucet: 60, minPredictions: 50, minDaysSinceJoined: 7, requiresEmail: true,
    rewardPoints: 5000,
    benefits: { maxBetPoints: 7500, maxWithdrawBolis: 50 }
  },
  { 
    level: 6, name: "Maestro", icon: "👑", color: "text-amber-400", glow: "shadow-amber-500/50",
    minBets: 5000, minFaucet: 100, minPredictions: 150, minDaysSinceJoined: 15, requiresEmail: true,
    rewardPoints: 10000,
    benefits: { maxBetPoints: 10000, maxWithdrawBolis: 100 }
  },
  { 
    level: 7, name: "Leyenda", icon: "🔥", color: "text-red-400", glow: "shadow-red-500/60",
    minBets: 10000, minFaucet: 200, minPredictions: 400, minDaysSinceJoined: 30, requiresEmail: true,
    rewardPoints: 25000,
    benefits: { maxBetPoints: 10000, maxWithdrawBolis: 250 }
  },
];

/**
 * Convierte el valor JSON de site_settings (string u objeto) a string para getDynamicLevels.
 */
export function parseLevelLimitsValue(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return String(value);
}

/**
 * Aplica sobreescrituras desde JSON si existen en la configuración 'LEVEL_LIMITS' (site_settings).
 * Formato: { "1": { "maxBet": 1000, "maxWithdraw": 5, "rewardPoints": 0 }, "2": ... }
 */
export function getDynamicLevels(overridesJson?: string): UserLevel[] {
  if (!overridesJson) return LEVELS;
  try {
    const overrides = JSON.parse(overridesJson);
    return LEVELS.map((lvl) => {
      const ov = overrides[lvl.level] ?? overrides[String(lvl.level)] ?? overrides[lvl.name];
      if (!ov || typeof ov !== "object") return lvl;
      return {
        ...lvl,
        rewardPoints: typeof ov.rewardPoints === "number" ? ov.rewardPoints : lvl.rewardPoints,
        benefits: {
          maxBetPoints: typeof ov.maxBet === "number" ? ov.maxBet : lvl.benefits.maxBetPoints,
          maxWithdrawBolis: typeof ov.maxWithdraw === "number" ? ov.maxWithdraw : lvl.benefits.maxWithdrawBolis,
        },
      };
    });
  } catch (e) {
    console.error("[Levels] Error parsing LEVEL_LIMITS override:", e);
    return LEVELS;
  }
}

/** Niveles efectivos desde BD (site_settings.LEVEL_LIMITS). */
export async function fetchActiveLevels(supabase: { from: (t: string) => any }): Promise<UserLevel[]> {
  const { data } = await supabase.from("site_settings").select("value").eq("key", "LEVEL_LIMITS").maybeSingle();
  return getDynamicLevels(parseLevelLimitsValue(data?.value));
}

export function getUserLevel(
  stats: {
    betCount: number;
    faucetClaims: number;
    predictionCount: number;
    daysSinceJoined: number; // Días desde la inscripción
    emailVerified: boolean;
  },
  allLevels: UserLevel[] = LEVELS
): UserLevel {
  let result = allLevels[0];
  for (const lvl of allLevels) {
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

export function getNextLevel(current: UserLevel, allLevels: UserLevel[] = LEVELS): UserLevel | null {
  const idx = allLevels.findIndex((l) => l.level === current.level);
  if (idx < 0 || idx >= allLevels.length - 1) return null;
  return allLevels[idx + 1];
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
export async function fetchUserLevel(
  supabase: any,
  userId: string,
  preloadedLevels?: UserLevel[]
): Promise<UserLevel> {
  const [{ data: p }, activeLevels] = await Promise.all([
    supabase.from("profiles").select("hilo_bet_count, faucet_claim_count, prediction_count, email_verified_at, created_at").eq("id", userId).single(),
    preloadedLevels ? Promise.resolve(preloadedLevels) : fetchActiveLevels(supabase),
  ]);
  if (!p) return activeLevels[0];

  const daysSinceJoined = p.created_at
    ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
    : 0;

  const stats = {
    betCount: p.hilo_bet_count ?? 0,
    faucetClaims: p.faucet_claim_count ?? 0,
    predictionCount: p.prediction_count ?? 0,
    daysSinceJoined,
    emailVerified: !!p.email_verified_at,
  };

  // Usamos una versión local de getUserLevel que acepte el array de niveles
  let result = activeLevels[0];
  for (const lvl of activeLevels) {
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

/** 
 * Verifica si el usuario ha subido de nivel y envía una notificación por correo 
 */
export async function checkAndNotifyLevelUp(supabase: any, userId: string, email: string, name?: string) {
  const activeLevels = await fetchActiveLevels(supabase);
  const currentLevel = await fetchUserLevel(supabase, userId, activeLevels);

  // GUARD ATÓMICO EXACTLY-ONCE: solo UNA llamada logra elevar last_notified_level.
  // El UPDATE condicional (last_notified_level < nivel) es atómico en la DB, así
  // que cierra (a) la race entre acciones concurrentes en el umbral y (b) la
  // re-acreditación si fallaba el email (antes el guard se ponía DESPUÉS del email).
  const { data: bumped } = await supabase
    .from("profiles")
    .update({ last_notified_level: currentLevel.level })
    .eq("id", userId)
    .or(`last_notified_level.is.null,last_notified_level.lt.${currentLevel.level}`)
    .select("id");

  // Si no se actualizó ninguna fila: no hubo subida real, o ya lo procesó otra
  // llamada concurrente. En ambos casos no acreditamos ni notificamos.
  if (!bumped || bumped.length === 0) return;

  const benefitsMap: string[] = [
    `Límite de apuesta aumentado a <strong>${currentLevel.benefits.maxBetPoints.toLocaleString()}</strong> puntos.`,
    `Límite de retiro aumentado a <strong>${currentLevel.benefits.maxWithdrawBolis} BOLIS</strong>.`
  ];

  if (currentLevel.level >= 4) { // Veterano+
    benefitsMap.push("Acceso prioritario a nuevas funciones de casino.");
  }

  // Acreditar recompensa en puntos si existe (ahora exactly-once: el guard ya
  // ganó arriba, así que esto se ejecuta una sola vez por subida de nivel).
  if (currentLevel.rewardPoints > 0) {
    try {
      // Leemos el multiplicador con el supabase ya disponible para NO importar
      // site-settings.ts (arrastra supabase/server -> next/headers al bundle de
      // cliente, pues levels.ts lo consumen componentes cliente).
      let wagerMult = 20;
      try {
        const { data: wm } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "WAGERING_MULTIPLIER")
          .single();
        if (wm?.value != null) {
          const parsed = typeof wm.value === "string" ? JSON.parse(wm.value) : wm.value;
          if (Number.isFinite(Number(parsed))) wagerMult = Number(parsed);
        }
      } catch { /* fallback 20 */ }
      await supabase.rpc("credit_bonus_points", {
        p_user_id: userId,
        p_amount: currentLevel.rewardPoints,
        p_wager_mult: wagerMult,
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

  // Email al final: si falla, ya NO causa re-acreditación (el guard está puesto).
  try {
    const { sendEmailViaResend } = await import("./resend");
    const { getLevelCardEmail } = await import("./mail-templates");
    const nextLvl = getNextLevel(currentLevel, activeLevels);

    await sendEmailViaResend({
      to: email,
      subject: `${currentLevel.icon} ¡Subiste al nivel ${currentLevel.name} en FreeBoli!`,
      html: getLevelCardEmail({
        userName: name || email.split('@')[0],
        levelLevel: currentLevel.level,
        levelName: currentLevel.name,
        levelIcon: currentLevel.icon,
        xpPercent: nextLvl ? 5 : 100,
        maxBetPoints: currentLevel.benefits.maxBetPoints,
        maxWithdrawBolis: currentLevel.benefits.maxWithdrawBolis,
        rewardPoints: currentLevel.rewardPoints,
        nextLevelName: nextLvl?.name,
        nextLevelIcon: nextLvl?.icon,
        benefits: benefitsMap,
      })
    });

    console.log(`[LevelUp] Email enviado a ${email} por subir al nivel ${currentLevel.level}`);
  } catch (err) {
    console.error("[LevelUp] Error enviando email:", err);
  }
}
