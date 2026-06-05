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
