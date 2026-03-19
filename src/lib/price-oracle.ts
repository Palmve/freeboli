/**
 * Price Oracle para obtener precios de criptomonedas.
 * Usa Binance para BTC/SOL y Jupiter para BOLIS.
 */

const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price";
const DEXSCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens";

type Asset = "BTC" | "SOL" | "BOLIS";

const ASSET_SYMBOLS: Record<Asset, string> = {
  BTC: "BTCUSDT",
  SOL: "SOLUSDT",
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
      });
      if (!res.ok) throw new Error(`DexScreener API error: ${res.status}`);
      const data = await res.json();
      const price = data.pairs?.[0]?.priceUsd;
      return price ? parseFloat(price) : null;
    } else {
      // Usar Binance para BTC/SOL
      const res = await fetch(`${BINANCE_TICKER_URL}?symbol=${symbolOrMint}`, {
        next: { revalidate: 0 },
      });
      if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
      const data = await res.json();
      return parseFloat(data.price);
    }
  } catch (error) {
    console.error(`Error fetching price for ${asset}:`, error);
    return null;
  }
}

/**
 * Calcula la cuota dinámica para una predicción.
 */
export function calculateDynamicOdds(
  side: "up" | "down",
  startPrice: number,
  currentPrice: number,
  timeLeftSec: number,
  houseEdge: number = 0.05
): number {
  let probability = 0.5;
  const diffPct = (currentPrice - startPrice) / startPrice;
  
  // Factor de sensibilidad: aumenta a medida que el tiempo se acaba.
  const timeFactor = 1 + (3600 - timeLeftSec) / 600; 
  
  probability += diffPct * 10 * timeFactor; 

  probability = Math.max(0.01, Math.min(0.99, probability));
  const winProb = side === "up" ? probability : 1 - probability;
  const odds = (1 / winProb) * (1 - houseEdge);

  return Math.max(1.01, Math.min(50, odds));
}
