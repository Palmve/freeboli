import { createAdminClient } from "@/lib/supabase/admin";
import { getCryptoPrice, calculateDynamicOdds } from "./price-oracle";
import { getSetting } from "./site-settings";

export type PredictionAsset = "BTC" | "SOL" | "BOLIS";
export type PredictionRoundType = "hourly" | "mini" | "micro";

/**
 * Obtiene el último dígito del precio según el tipo de activo (unificación oráculo).
 */
export function getPredictionMicroDigit(price: number, asset: PredictionAsset): string {
    const decimals = asset === "BOLIS" ? 6 : asset === "SOL" ? 3 : 2;
    return price.toFixed(decimals).slice(-1);
}

/**
 * Asegura que exista una ronda activa para el asset dado en la hora actual o bloque de 10 min.
 */
export async function ensureActiveRound(asset: PredictionAsset, type: PredictionRoundType = "hourly"): Promise<{ data?: any; error?: string }> {
  const supabase = createAdminClient();
  const now = new Date();
  
  const startTime = new Date(now);
  if (type === "mini") {
    const minutes = Math.floor(startTime.getMinutes() / 10) * 10;
    startTime.setMinutes(minutes, 0, 0);
  } else if (type === "micro") {
    const minutes = Math.floor(startTime.getMinutes() / 2) * 2;
    startTime.setMinutes(minutes, 0, 0);
  } else {
    startTime.setMinutes(0, 0, 0);
  }
  
  const endTime = new Date(startTime);
  if (type === "mini") {
    endTime.setMinutes(endTime.getMinutes() + 10);
  } else if (type === "micro") {
    endTime.setMinutes(endTime.getMinutes() + 2);
  } else {
    endTime.setHours(endTime.getHours() + 1);
  }

  const { data: existing } = await supabase
    .from("prediction_rounds")
    .select("*")
    .eq("asset", asset)
    .eq("type", type)
    .eq("start_time", startTime.toISOString())
    .single();

  if (existing) return { data: existing };

  let openPrice = await getCryptoPrice(asset);
  if (openPrice === null) {
      return { error: `No se pudo obtener el precio de apertura para ${asset}.` };
  }

  if (asset === "BOLIS") {
    openPrice = Number(openPrice.toFixed(6));
  }

  const { data: newRound, error } = await supabase
    .from("prediction_rounds")
    .insert({
      asset,
      type,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      opening_price: openPrice,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    return { error: `Error de base de datos al crear la ronda: ${error.message}` };
  }
  return { data: newRound };
}

/**
 * Obtiene la ronda activa y calcula las cuotas actuales.
 */
export async function getActiveRoundWithOdds(asset: PredictionAsset, type: PredictionRoundType = "hourly") {
  const { data: round, error: ensureError } = await ensureActiveRound(asset, type);
  if (ensureError) return { error: ensureError };
  if (!round) return { error: "No se encontró la ronda." };
  
  if (round.status !== "open") return { error: `Ronda cerrada (status: ${round.status}).` };

  const currentPrice = await getCryptoPrice(asset);
  if (currentPrice === null) return { error: `Error de precio.` };

  const now = new Date();
  const endTime = new Date(round.end_time);
  const timeLeftSec = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
  
  let oddsUp = 0;
  let oddsDown = 0;
  let oddsMicro = 0;

  const houseEdge = await getSetting<number>("PREDICTION_HOUSE_EDGE", 0.05);

  if (round.type === "micro") {
    // (MICRO eliminado; se mantiene solo para resolver rondas antiguas que sigan vivas.)
    if (timeLeftSec >= 100) oddsMicro = 9;
    else if (timeLeftSec >= 80) oddsMicro = 8;
    else if (timeLeftSec > 60) oddsMicro = 7;
    else oddsMicro = 0;
  } else {
    const totalTimeSec = round.type === "mini" ? 600 : 3600;
    oddsUp = calculateDynamicOdds("up", round.opening_price, currentPrice, timeLeftSec, totalTimeSec, round.asset as any, houseEdge);
    oddsDown = calculateDynamicOdds("down", round.opening_price, currentPrice, timeLeftSec, totalTimeSec, round.asset as any, houseEdge);
  }

  return {
    ...round,
    current_price: currentPrice,
    odds: round.type === "micro" ? { micro: oddsMicro } : {
      up: parseFloat(oddsUp.toFixed(2)),
      down: parseFloat(oddsDown.toFixed(2)),
    },
    house_edge: houseEdge,
    time_left_sec: timeLeftSec,
  };
}

/**
 * Procesa la resolución de rondas terminadas de forma masiva.
 */
export async function resolvePendingRounds() {
  const supabase = createAdminClient();
  const now = new Date();

  const { data: pending } = await supabase
    .from("prediction_rounds")
    .select("*")
    .in("status", ["open", "closed"])
    .lt("end_time", now.toISOString());

  if (!pending || pending.length === 0) return 0;

  const results = await Promise.all(pending.map(async (round) => {
    try {
      const closePriceRaw = await getCryptoPrice(round.asset as PredictionAsset);
      if (closePriceRaw === null) return false;

      const closePrice = round.asset === "BOLIS" ? Number(closePriceRaw.toFixed(6)) : closePriceRaw;
      
      let result = "draw";
      let microResult = "";
      if (round.type === "micro") {
        microResult = getPredictionMicroDigit(closePriceRaw, round.asset as PredictionAsset);
      } else {
        const closePrice = round.asset === "BOLIS" ? Number(closePriceRaw.toFixed(6)) : closePriceRaw;
        result = closePrice > round.opening_price ? "up" : closePrice < round.opening_price ? "down" : "draw";
      }

      // 1. Obtener todas las apuestas de esta ronda
      const { data: bets } = await supabase
        .from("prediction_bets")
        .select("*")
        .eq("round_id", round.id);

      if (bets && bets.length > 0) {
        for (const bet of bets) {
          let payout = 0;
          let status = "lost";

          if (round.type === "micro") {
            if (bet.prediction === microResult) {
                payout = bet.potential_payout || Math.floor(bet.amount * (bet.odds_at_bet || 7));
                status = "won";
            }
          } else {
            if (result === "draw") {
                payout = bet.amount; // Devolución en empate
                status = "draw";
            } else if (bet.prediction === result) {
                payout = bet.potential_payout || Math.floor(bet.amount * (bet.odds_at_bet || 1.95));
                status = "won";
            }
          }

          // RESOLUCIÓN ATÓMICA vía RPC (Migración 018)
          await supabase.rpc("resolve_prediction_bet", {
              p_bet_id: bet.id,
              p_round_id: round.id,
              p_status: status,
              p_payout: payout
          });
        }
      }

      await supabase.from("prediction_rounds").update({ 
        closing_price: closePrice, 
        status: "resolved" 
      }).eq("id", round.id);

      return true;
    } catch (err) {
      console.error(`[PredictResolve] Error ${round.id}:`, err);
      return false;
    }
  }));

  return results.filter(Boolean).length;
}
