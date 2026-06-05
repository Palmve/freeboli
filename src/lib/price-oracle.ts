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

export const SIGMAS: Record<Asset, number> = {
  BTC: 0.0065,  // Desviación típica del % de cambio en 1 hora (Bitcoin)
  SOL: 0.012,   // Desviación típica del % de cambio en 1 hora (Solana)
  BOLIS: 0.035, // Alta volatilidad (Token nativo/Memecoin)
};

/** CDF normal estándar Φ(x) — aproximación de Abramowitz-Stegun (error < 7.5e-8). */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-(x * x) / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/**
 * Calcula la cuota dinámica para una predicción UP/DOWN.
 *
 * Modelo (corrección auditoría #1, v1.161.0): bajo log-precio martingala (mercado
 * eficiente, deriva 0) la probabilidad VERDADERA de cerrar por encima de la apertura es
 *     P(cierre > apertura) = Φ( ln(P_now/P_start) / (σ·√T_left) )
 * con σ = SIGMAS[asset]/√3600 (volatilidad por segundo; SIGMAS calibran la ronda de 1h).
 * La cuota se deriva de esa probabilidad: odds = (1/prob)·(1−edge). Así el RTP de
 * CUALQUIER lado/estrategia = 1−edge (no explotable), a diferencia del modelo sigmoide
 * anterior que subreaccionaba y sobrepagaba al favorito (ver scripts/audit_predictions.mjs).
 *
 * El escalado por duración es automático vía √T_left: una mini (10 min) es más decisiva
 * que una hourly para el mismo % de movimiento, sin factores ad-hoc.
 */
export function calculateDynamicOdds(
  side: "up" | "down",
  startPrice: number,
  currentPrice: number,
  timeLeftSec: number,
  totalTimeSec: number = 3600,
  asset: Asset = "BTC",
  houseEdge: number = 0.05,
  /**
   * Cap de cuota máxima (configurable: site_settings.PREDICTION_MAX_ODDS). Bajado de 30
   * a 10 como mitigación: a cuotas altas el lado improbable era explotable (RTP del jugador
   * hasta ~215% en alta volatilidad). Ver scripts/audit_predictions.mjs.
   */
  maxOddsCap: number = 10
): number {
  if (startPrice <= 0 || currentPrice <= 0) return 1.90;

  // Volatilidad por segundo (SIGMAS calibran la desviación del % a 1h: σ_seg = σ_1h/√3600).
  const sigPerSec = (SIGMAS[asset] || 0.006) / Math.sqrt(3600);
  const tLeft = Math.max(1, timeLeftSec);
  const sigMove = sigPerSec * Math.sqrt(tLeft); // desviación del movimiento que queda

  // Probabilidad verdadera de cerrar por encima de la apertura: Φ( ln(P_now/P_start)/σ_move ).
  const z = Math.log(currentPrice / startPrice) / sigMove;
  const probUp = Math.max(0.02, Math.min(0.98, normCdf(z)));
  const winProb = side === "up" ? probUp : 1 - probUp;

  // Cuota a partir de la probabilidad real, con el margen de la casa (edge).
  const odds = (1 / winProb) * (1 - houseEdge);

  // Cuota mínima 1.05x para que siempre haya beneficio; máxima = maxOddsCap (configurable).
  // En el último 5% de la ronda se recorta a 2/3 del cap (más conservador al final).
  const tRel = timeLeftSec / totalTimeSec;
  const maxOdds = tRel < 0.05 ? Math.max(1.05, Math.round(maxOddsCap * 0.67)) : maxOddsCap;
  return parseFloat(Math.max(1.05, Math.min(maxOdds, odds)).toFixed(2));
}
