/**
 * Price Oracle para obtener precios de criptomonedas.
 * BTC/SOL: mediana de varias fuentes (Coinbase, Binance, Kraken) con timeout y fallback,
 * para resistir caídas de una fuente y datos anómalos/manipulados.
 * BOLIS: DexScreener (solo para resolver rondas antiguas; ya no es objeto de predicción).
 */

const DEXSCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens";
const BOLIS_MINT = "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha";

type Asset = "BTC" | "SOL" | "BOLIS";

const FETCH_TIMEOUT_MS = 3500;

/** fetch con timeout (AbortController) para que una fuente lenta no cuelgue la ronda. */
async function fetchJson(url: string, init?: RequestInit): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, next: { revalidate: 0 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isValidPrice(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function median(values: number[]): number | null {
  const xs = values.filter(isValidPrice).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

// --- Fuentes para BTC/SOL ---
async function fromCoinbase(asset: "BTC" | "SOL"): Promise<number | null> {
  const d = await fetchJson(`https://api.coinbase.com/v2/prices/${asset}-USD/spot`);
  const p = parseFloat(d?.data?.amount);
  return isValidPrice(p) ? p : null;
}

async function fromBinance(asset: "BTC" | "SOL"): Promise<number | null> {
  const symbol = asset === "BTC" ? "BTCUSDT" : "SOLUSDT";
  const d = await fetchJson(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  const p = parseFloat(d?.price);
  return isValidPrice(p) ? p : null;
}

async function fromKraken(asset: "BTC" | "SOL"): Promise<number | null> {
  const pair = asset === "BTC" ? "XBTUSD" : "SOLUSD";
  const d = await fetchJson(`https://api.kraken.com/0/public/Ticker?pair=${pair}`);
  const result = d?.result;
  if (!result || typeof result !== "object") return null;
  const first: any = Object.values(result)[0];
  const p = parseFloat(first?.c?.[0]);
  return isValidPrice(p) ? p : null;
}

async function getMajorPrice(asset: "BTC" | "SOL"): Promise<number | null> {
  const settled = await Promise.allSettled([
    fromCoinbase(asset),
    fromBinance(asset),
    fromKraken(asset),
  ]);
  const prices = settled
    .map((s) => (s.status === "fulfilled" ? s.value : null))
    .filter(isValidPrice) as number[];

  if (prices.length === 0) return null;
  return median(prices);
}

async function getBolisPrice(): Promise<number | null> {
  const d = await fetchJson(`${DEXSCREENER_API_URL}/${BOLIS_MINT}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  });
  const p = parseFloat(d?.pairs?.[0]?.priceUsd);
  return isValidPrice(p) ? p : null;
}

export async function getCryptoPrice(asset: Asset): Promise<number | null> {
  try {
    if (asset === "BOLIS") return await getBolisPrice();
    return await getMajorPrice(asset);
  } catch (error) {
    console.error(`Error fetching price for ${asset}:`, error);
    return null;
  }
}

const SIGMAS: Record<Asset, number> = {
  BTC: 0.0065,  // Volatilidad moderada (Bitcoin)
  SOL: 0.012,   // Volatilidad media (Solana)
  BOLIS: 0.035, // Alta volatilidad (Token nativo/Memecoin)
};

/**
 * Calcula la cuota dinámica para una predicción usando decaimiento de volatilidad suavizado.
 * Basado en un modelo de difusión logística optimizado para bajo volumen.
 */
export function calculateDynamicOdds(
  side: "up" | "down",
  startPrice: number,
  currentPrice: number,
  timeLeftSec: number,
  totalTimeSec: number = 3600,
  asset: Asset = "BTC",
  houseEdge: number = 0.05
): number {
  if (startPrice <= 0 || currentPrice <= 0) return 1.90;

  const diffPct = (currentPrice - startPrice) / startPrice;

  // Tiempo relativo restante (1.0 inicio -> 0 final)
  const tRel = Math.max(0.0001, timeLeftSec / totalTimeSec);

  // Parámetros de sensibilidad
  const k = 0.8; // Suavizado para evitar cuotas extremas demasiado rápido
  // sigma calibrado a la DURACIÓN de la ronda: la volatilidad escala ~sqrt(tiempo).
  // Los SIGMAS base representan una ronda de 1h; una mini (10 min) usa un sigma menor,
  // de modo que un mismo movimiento % resulta más decisivo (menos tiempo para revertir).
  const sigma = (SIGMAS[asset] || 0.006) * Math.sqrt(totalTimeSec / 3600);

  /**
   * Modelo: Probabilidad Sigmoide Escalada
   * Agregamos 0.08 al tiempo relativo para mantener incertidumbre "suave" hasta el final.
   */
  const timeFactor = Math.sqrt(tRel + 0.08);
  const exponent = (k * diffPct) / (sigma * timeFactor);
  const probUp = 1 / (1 + Math.exp(-exponent));

  // Limitar probabilidad para evitar odds infinitas
  const finalProbUp = Math.max(0.01, Math.min(0.99, probUp));
  const winProb = side === "up" ? finalProbUp : 1 - finalProbUp;

  // Aplicar House Edge y calcular cuota
  const odds = (1 / winProb) * (1 - houseEdge);

  // Cuota mínima 1.05x para que siempre haya beneficio, Máxima 30x para limitar riesgo en low-volume
  const maxOdds = tRel < 0.05 ? 20 : 30; // Más conservador al final
  return parseFloat(Math.max(1.05, Math.min(maxOdds, odds)).toFixed(2));
}
