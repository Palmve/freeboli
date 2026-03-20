/**
 * Price Oracle para obtener precios de criptomonedas.
 * Usa Binance para BTC/SOL y Jupiter para BOLIS.
 */

const COINBASE_PRICE_URL = "https://api.coinbase.com/v2/prices";
const DEXSCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens";

type Asset = "BTC" | "SOL" | "BOLIS";

const ASSET_SYMBOLS: Record<Asset, string> = {
  BTC: "BTC-USD",
  SOL: "SOL-USD",
  BOLIS: "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha", // Mint address
};

export async function getCryptoPrice(asset: Asset): Promise<number | null> {
  const symbolOrMint = ASSET_SYMBOLS[asset];
  if (!symbolOrMint) return null;

  try {
    if (asset === "BOLIS") {
      // Usar DexScreener para BOLIS
      const res = await fetch(`${DEXSCREENER_API_URL}/${symbolOrMint}`, {
        next: { revalidate: 0 },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        }
      });
      if (!res.ok) throw new Error(`DexScreener API error: ${res.status}`);
      const data = await res.json();
      const price = data.pairs?.[0]?.priceUsd;
      return price ? parseFloat(price) : null;
    } else {
      // Usar Coinbase para BTC/SOL
      const res = await fetch(`${COINBASE_PRICE_URL}/${symbolOrMint}/spot`, {
        next: { revalidate: 0 },
      });
      if (!res.ok) throw new Error(`Coinbase API error: ${res.status}`);
      const data = await res.json();
      return parseFloat(data.data.amount);
    }
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
  const sigma = SIGMAS[asset] || 0.006;
  
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
