import { createHash, randomBytes } from "crypto";

/** Roll 0..9999; proporción 49% jugador / 51% casa (house edge ~2%) */
const ROLL_MAX = 10000;

export type HiLoChoice = "hi" | "lo";

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
  return n % ROLL_MAX;
}

/**
 * Genera hash SHA256 en hex del server seed (para compromiso previo al roll).
 */
export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed, "utf8").digest("hex");
}

/**
 * Determina si el jugador gana según su elección y el rollo.
 * - Hi: gana si roll >= 5100 (4900 valores).
 * - Lo: gana si roll <= 4899 (4900 valores).
 * - 4900-5099: casa gana (200 valores).
 */
export function isPlayerWin(roll: number, choice: HiLoChoice): boolean {
  if (choice === "hi") return roll >= 5100;
  return roll <= 4899;
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

const ODDS_MIN = 1.01;
const ODDS_MAX = 4900;

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Ejecuta una tirada HI-LO con sistema "provably fair".
 * - server_seed: aleatorio del servidor (se revela después).
 * - server_seed_hash: hash del server_seed (se muestra antes para compromiso).
 * - client_seed y nonce: permiten verificar el roll en el navegador.
 * El roll es determinista: rollFromSeeds(server_seed, client_seed, nonce).
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
  const win = isPlayerWin(roll, choice);
  let odds = Number(oddsRaw);
  if (!Number.isFinite(odds) || odds < ODDS_MIN || odds > ODDS_MAX) {
    odds = Number(process.env.NEXT_PUBLIC_HILO_WIN_MULTIPLIER) || 2;
  }
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
