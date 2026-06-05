import { createHash, randomBytes } from "crypto";

/** Tirada uniforme en 0..9999 (10000 resultados posibles). */
export const HILO_ROLL_MOD = 10000;

export type HiLoChoice = "hi" | "lo";

/** Retorno teórico al jugador: probabilidad_acierto(%) × cuota ≈ 98 → ventaja casa ~2%. */
export const HILO_HOUSE_EDGE_FACTOR = 98;

export const HILO_ODDS_MIN = 1.01;
export const HILO_ODDS_MAX = 4900;

/**
 * Límites de k (resultados ganadores). La cuota efectiva es 9800/k, así que:
 *   k=2    -> 9800/2 = 4900   (cuota máxima)
 *   k=9702 -> 9800/9702 ≈ 1.0101 (cuota mínima, ≥ 1.01)
 */
const HILO_K_MIN = 2;
const HILO_K_MAX = 9702;

/**
 * Calcula el roll de forma determinista a partir de server_seed, client_seed y nonce.
 * Misma fórmula que en el verificador del navegador (provably fair).
 */
export function rollFromSeeds(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): number {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`;
  const hash = createHash("sha256").update(combined, "utf8").digest();
  const n = hash.readUInt32BE(0);
  return n % HILO_ROLL_MOD;
}

/**
 * Genera hash SHA256 en hex del server seed (para compromiso previo al roll).
 */
export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed, "utf8").digest("hex");
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

/** Cuota efectiva tras clamp (misma lógica que en la jugada). */
export function normalizeHiLoOdds(oddsRaw?: number): number {
  let odds = Number(oddsRaw);
  if (!Number.isFinite(odds) || odds < HILO_ODDS_MIN || odds > HILO_ODDS_MAX) {
    odds = Number(process.env.NEXT_PUBLIC_HILO_WIN_MULTIPLIER) || 2;
  }
  if (!Number.isFinite(odds) || odds < HILO_ODDS_MIN || odds > HILO_ODDS_MAX) {
    odds = 2;
  }
  return odds;
}

/**
 * Cantidad de valores de tirada ganadores para HI (o para LO).
 *
 * El roll es entero en [0, 9999], así que P(ganar) sólo puede ser k/10000 con k
 * entero. Para un RTP exacto del 98% se "snapea" la cuota pedida a la rejilla:
 *   k = round(9800 / cuotaPedida)
 * y luego se paga la cuota EFECTIVA 9800/k (ver hiLoEffectiveOdds). Como el pago
 * se deriva de k, el redondeo (round) ya es seguro: RTP = (k/10000)·(9800/k) = 0.98
 * SIEMPRE, sin posibilidad de RTP > 100%.
 */
export function hiLoWinningOutcomes(oddsRequested: number): number {
  const raw = Math.round((HILO_HOUSE_EDGE_FACTOR * 100) / oddsRequested);
  return Math.min(HILO_K_MAX, Math.max(HILO_K_MIN, raw));
}

/**
 * Cuota efectiva (la que se MUESTRA y se PAGA) derivada de k: 9800/k.
 * Garantiza RTP = (k/10000)·(9800/k) = 98% exacto, independiente de la cuantización.
 */
export function hiLoEffectiveOdds(k: number): number {
  return (HILO_HOUSE_EDGE_FACTOR * 100) / k;
}

/**
 * Apuesta mínima para que la ganancia (profit) sea ≥ 1 punto a la cuota efectiva dada.
 * floor(bet·odds) − bet ≥ 1  ⟺  bet ≥ 1/(odds−1).
 */
export function hiLoMinBet(effectiveOdds: number): number {
  if (!(effectiveOdds > 1)) return 1;
  return Math.max(1, Math.ceil(1 / (effectiveOdds - 1)));
}

export interface HiLoRuleThresholds {
  /** Cuota pedida por el usuario tras clamp. */
  odds: number;
  /** Cuota efectiva (la que se muestra y se paga) = 9800/k. */
  effectiveOdds: number;
  /** Apuesta mínima para que la ganancia sea ≥ 1 punto a la cuota efectiva. */
  minBet: number;
  k: number;
  hiMin: number;
  loMax: number;
  deadMin: number;
  deadMax: number;
  hasDeadZone: boolean;
  /** Probabilidad aproximada de ganar al apostar HI o LO (misma para ambas), en %. */
  winChancePctLabel: string;
}

/** Umbrales para reglas en UI y para isPlayerWin (misma cuota). */
export function hiLoRuleThresholds(oddsRaw?: number): HiLoRuleThresholds {
  const odds = normalizeHiLoOdds(oddsRaw);
  const k = hiLoWinningOutcomes(odds);
  const effectiveOdds = hiLoEffectiveOdds(k);
  const minBet = hiLoMinBet(effectiveOdds);
  const hiMin = HILO_ROLL_MOD - k;
  const loMax = k - 1;
  const deadMin = k;
  const deadMax = HILO_ROLL_MOD - k - 1;
  const hasDeadZone = deadMin <= deadMax;
  const winChancePctLabel = (k / 100).toFixed(2);
  return { odds, effectiveOdds, minBet, k, hiMin, loMax, deadMin, deadMax, hasDeadZone, winChancePctLabel };
}

/**
 * Determina si el jugador gana según elección, tirada y cuota.
 * - HI: gana en los k valores más altos (roll >= 10000 - k).
 * - LO: gana en los k valores más bajos (roll <= k - 1).
 * - Entre medias (si existe franja): gana la casa.
 */
export function isPlayerWin(roll: number, choice: HiLoChoice, odds?: number): boolean {
  const o = normalizeHiLoOdds(odds);
  const k = hiLoWinningOutcomes(o);
  if (choice === "hi") return roll >= HILO_ROLL_MOD - k;
  return roll <= k - 1;
}

export interface HiLoVerification {
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
}

export interface HiLoResult {
  roll: number;
  choice: HiLoChoice;
  win: boolean;
  bet: number;
  payout: number;
  /** Cuota pedida (clamp). */
  odds: number;
  /** Cuota efectiva pagada = 9800/k. */
  effectiveOdds: number;
  verification: HiLoVerification;
}

/**
 * Ejecuta una tirada HI-LO con sistema "provably fair".
 * La probabilidad de acierto depende de la cuota (×98% RTP); no es fija al 49%.
 */
export function playHiLo(
  bet: number,
  choice: HiLoChoice,
  oddsRaw?: number,
  clientSeed?: string,
  nonce?: number
): HiLoResult {
  const server_seed = randomHex(32);
  const server_seed_hash = hashServerSeed(server_seed);
  const client_seed =
    typeof clientSeed === "string" && clientSeed.trim()
      ? clientSeed.trim().slice(0, 64)
      : randomHex(16);
  const nonceNum = typeof nonce === "number" && Number.isInteger(nonce) && nonce >= 0 ? nonce : 0;

  const roll = rollFromSeeds(server_seed, client_seed, nonceNum);
  const odds = normalizeHiLoOdds(oddsRaw);
  const k = hiLoWinningOutcomes(odds);
  const effectiveOdds = hiLoEffectiveOdds(k);
  const win = choice === "hi" ? roll >= HILO_ROLL_MOD - k : roll <= k - 1;
  const payout = win ? Math.floor(bet * effectiveOdds) : 0;

  return {
    roll,
    choice,
    win,
    bet,
    payout,
    odds,
    effectiveOdds,
    verification: {
      server_seed,
      server_seed_hash,
      client_seed,
      nonce: nonceNum,
    },
  };
}
