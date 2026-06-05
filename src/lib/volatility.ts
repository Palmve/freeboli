/**
 * Estimación de volatilidad realizada (σ viva) para el modelo de cuotas de Predicciones.
 * σ = desviación típica del % de cambio en 1 hora (mismas unidades que SIGMAS de price-oracle).
 *
 * Módulo SIN imports a propósito: así los tests Node (type-strip) lo cargan sin cruzar
 * imports con extensión, y el baseline σ entra como PARÁMETRO (su única fuente sigue siendo
 * SIGMAS en price-oracle, que pasan los llamadores: cron y getModelSigma).
 * Ver docs/superpowers/specs/2026-06-05-prediccion-sigma-viva-ewma-design.md
 */

/** Memoria de la EWMA (λ≈0.97 ⇒ ~33h de memoria efectiva sobre datos horarios). */
const EWMA_LAMBDA = 0.97;
/** Mínimo de retornos para una estimación con sentido. */
const MIN_RETURNS = 30;

/**
 * σ horaria por EWMA de los retornos log de una serie de precios de cierre HORARIOS.
 * Asume deriva ~0 (martingala): usa r² directamente. Devuelve null si hay pocos datos.
 * Función PURA (sin red) → testeable con series inyectadas.
 */
export function ewmaSigmaFromCloses(closes: number[], lambda: number = EWMA_LAMBDA): number | null {
  const px = closes.filter((c) => typeof c === "number" && Number.isFinite(c) && c > 0);
  if (px.length < MIN_RETURNS + 1) return null;

  const returns: number[] = [];
  for (let i = 1; i < px.length; i++) returns.push(Math.log(px[i] / px[i - 1]));
  if (returns.length < MIN_RETURNS) return null;

  // Semilla: media de los primeros 10 r² (estabiliza el arranque), luego EWMA.
  const seedN = Math.min(10, returns.length);
  let variance = 0;
  for (let i = 0; i < seedN; i++) variance += returns[i] * returns[i];
  variance /= seedN;
  for (let i = seedN; i < returns.length; i++) {
    variance = lambda * variance + (1 - lambda) * returns[i] * returns[i];
  }
  return Math.sqrt(variance);
}

/** Acota σ a [baseline×0.5, baseline×4] contra datos anómalos. */
export function clampSigma(raw: number, baseline: number): number {
  return Math.max(baseline * 0.5, Math.min(baseline * 4, raw));
}

const FETCH_TIMEOUT_MS = 3500;

async function fetchJsonTimed(url: string): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, next: { revalidate: 0 } } as any);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Cierres horarios desde Binance (índice 4 de cada vela). ~168 velas = 7 días. */
async function binanceCloses(asset: "BTC" | "SOL"): Promise<number[] | null> {
  const symbol = asset === "BTC" ? "BTCUSDT" : "SOLUSDT";
  const d = await fetchJsonTimed(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=169`);
  if (!Array.isArray(d)) return null;
  const closes = d.map((k: any) => parseFloat(k?.[4])).filter((n) => Number.isFinite(n) && n > 0);
  return closes.length ? closes : null;
}

/** Fallback: cierres horarios desde Coinbase (índice 4; vienen del más nuevo al más viejo). */
async function coinbaseCloses(asset: "BTC" | "SOL"): Promise<number[] | null> {
  const product = asset === "BTC" ? "BTC-USD" : "SOL-USD";
  const d = await fetchJsonTimed(`https://api.exchange.coinbase.com/products/${product}/candles?granularity=3600`);
  if (!Array.isArray(d)) return null;
  // Cada vela: [time, low, high, open, close, volume]. Ordenar por time ascendente.
  const sorted = [...d].sort((a, b) => (a?.[0] ?? 0) - (b?.[0] ?? 0));
  const closes = sorted.map((k: any) => parseFloat(k?.[4])).filter((n) => Number.isFinite(n) && n > 0);
  return closes.length ? closes : null;
}

/**
 * σ realizada del activo: klines horarias (Binance→Coinbase) → EWMA → clamp a [×0.5, ×4]
 * del baseline. ok=false si la fuente falla o hay datos insuficientes (sigma = baseline).
 * `baseline` se recibe por parámetro (su fuente es SIGMAS en price-oracle) para que este
 * módulo NO importe nada y los tests Node lo carguen sin cruzar imports con extensión.
 */
export async function computeRealizedSigma(asset: "BTC" | "SOL", baseline: number): Promise<{ sigma: number; ok: boolean }> {
  const closes = (await binanceCloses(asset)) ?? (await coinbaseCloses(asset));
  if (!closes) return { sigma: baseline, ok: false };
  const raw = ewmaSigmaFromCloses(closes);
  if (raw === null) return { sigma: baseline, ok: false };
  return { sigma: clampSigma(raw, baseline), ok: true };
}

/** 3h: tolera hasta 2 ticks horarios perdidos antes de caer al baseline. */
export const SIGMA_MAX_AGE_MS = 3 * 3600 * 1000;

/**
 * Decide la σ del modelo a partir del valor live leído: si falta o está viejo (>maxAge),
 * usa el baseline; si no, aplica el piso conservador max(valor, baseline). PURA.
 */
export function resolveModelSigma(
  rawSigma: number | null,
  atMillis: number | null,
  nowMillis: number,
  baseline: number,
  maxAgeMs: number = SIGMA_MAX_AGE_MS
): number {
  if (rawSigma == null || atMillis == null || nowMillis - atMillis > maxAgeMs) return baseline;
  return Math.max(rawSigma, baseline);
}
