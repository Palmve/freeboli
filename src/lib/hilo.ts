import { createHash, randomBytes } from "crypto";

/** Tirada uniforme en 0..9999 (10000 resultados posibles). */
export const HILO_ROLL_MOD = 10000;

export type HiLoChoice = "hi" | "lo";

/** Retorno teórico al jugador: probabilidad_acierto(%) × cuota ≈ 98 → ventaja casa ~2%. */
export const HILO_HOUSE_EDGE_FACTOR = 98;

export const HILO_ODDS_MIN = 1.01;
export const HILO_ODDS_MAX = 4900;

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
 * Cantidad de valores de tirada ganadores para HI (o para LO), con RTP ~98%:
 * (k/10000) × cuota ≈ 0.98 → k ≈ 9800/cuota.
 * Tope k ≤ 9900 para mantener un RTP consistente incluso en cuotas bajas.
 */
export function hiLoWinningOutcomes(oddsEffective: number): number {
  const raw = Math.round((HILO_HOUSE_EDGE_FACTOR * 100) / oddsEffective);
  return Math.min(9900, Math.max(1, raw));
}

export interface HiLoRuleThresholds {
  odds: number;
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
  const hiMin = HILO_ROLL_MOD - k;
  const loMax = k - 1;
  const deadMin = k;
  const deadMax = HILO_ROLL_MOD - k - 1;
  const hasDeadZone = deadMin <= deadMax;
  const winChancePctLabel = (k / 100).toFixed(2);
  return { odds, k, hiMin, loMax, deadMin, deadMax, hasDeadZone, winChancePctLabel };
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
  const win = isPlayerWin(roll, choice, odds);
  const payout = win ? Math.floor(bet * odds) : 0;

  return {
    roll,
    choice,
    win,
    bet,
    payout,
    verification: {
      server_seed,
      server_seed_hash,
      client_seed,
      nonce: nonceNum,
    },
  };
}
