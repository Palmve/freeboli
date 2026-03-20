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

/**
 * Calcula la cuota dinámica para una predicción usando decaimiento de volatilidad.
 */
export function calculateDynamicOdds(
  side: "up" | "down",
  startPrice: number,
  currentPrice: number,
  timeLeftSec: number,
  totalTimeSec: number = 3600,
  houseEdge: number = 0.05
): number {
  if (startPrice <= 0 || currentPrice <= 0) return 2.0;

  const diffPct = (currentPrice - startPrice) / startPrice;
  
  // Tiempo relativo restante (1.0 al inicio, -> 0 al final)
  const tRel = Math.max(0.0001, timeLeftSec / totalTimeSec);
  
  /**
   * Modelo: Probabilidad Sigmoide Escalada
   * p = 1 / (1 + exp(-k * diffPct / (sigma * sqrt(tRel))))
   */
  const k = 1.0;
  const sigma = 0.006; // Volatilidad reducida = Sensibilidad aumentada
  
  const exponent = (k * diffPct) / (sigma * Math.sqrt(tRel));
  const probUp = 1 / (1 + Math.exp(-exponent));
  
  // Limitar probabilidad para evitar odds infinitas
  const finalProbUp = Math.max(0.01, Math.min(0.99, probUp));
  const winProb = side === "up" ? finalProbUp : 1 - finalProbUp;
  
  // Aplicar House Edge y calcular cuota
  const odds = (1 / winProb) * (1 - houseEdge);

  // Cuota mínima 1.05x, máxima 50x
  return Math.max(1.05, Math.min(50, odds));
}
