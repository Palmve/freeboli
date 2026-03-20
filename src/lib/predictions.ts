import { createAdminClient } from "@/lib/supabase/admin";
import { getCryptoPrice, calculateDynamicOdds } from "./price-oracle";
import { getSetting } from "./site-settings";

export type PredictionAsset = "BTC" | "SOL" | "BOLIS";
export type PredictionRoundType = "hourly" | "mini";

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
  } else {
    startTime.setMinutes(0, 0, 0);
  }
  
  const endTime = new Date(startTime);
  if (type === "mini") {
    endTime.setMinutes(endTime.getMinutes() + 10);
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
    openPrice = Number(openPrice.toFixed(4));
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
  
  const houseEdge = await getSetting<number>("PREDICTION_HOUSE_EDGE", 0.05);

  const oddsUp = calculateDynamicOdds("up", round.opening_price, currentPrice, timeLeftSec, houseEdge);
  const oddsDown = calculateDynamicOdds("down", round.opening_price, currentPrice, timeLeftSec, houseEdge);

  return {
    ...round,
    current_price: currentPrice,
    odds: {
      up: parseFloat(oddsUp.toFixed(2)),
      down: parseFloat(oddsDown.toFixed(2)),
    },
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
    .neq("status", "resolved")
    .neq("status", "cancelled")
    .neq("status", "closed")
    .lt("end_time", now.toISOString());

  if (!pending || pending.length === 0) return 0;

  const results = await Promise.all(pending.map(async (round) => {
    try {
      const closePriceRaw = await getCryptoPrice(round.asset as PredictionAsset);
      if (closePriceRaw === null) return false;

      const closePrice = round.asset === "BOLIS" ? Number(closePriceRaw.toFixed(4)) : closePriceRaw;
      const result = closePrice > round.opening_price ? "up" : closePrice < round.opening_price ? "down" : "draw";

      if (result === "draw") {
          const { data: allBets } = await supabase.from("prediction_bets").select("*").eq("round_id", round.id).eq("claimed", false);
          if (allBets) {
            for (const bet of allBets) {
              await supabase.rpc("atomic_add_points", { target_user_id: bet.user_id, amount_to_add: bet.amount });
              await supabase.from("movements").insert({
                user_id: bet.user_id,
                type: "premio_prediccion",
                points: bet.amount,
                metadata: { round_id: round.id, asset: round.asset, type: round.type, result: "draw" },
              });
              await supabase.from("prediction_bets").update({ claimed: true }).eq("id", bet.id);
            }
          }
      } else {
          const { data: winningBets } = await supabase
            .from("prediction_bets")
            .select("*")
            .eq("round_id", round.id)
            .eq("prediction", result)
            .eq("claimed", false);

          if (winningBets) {
            for (const bet of winningBets) {
              await supabase.rpc("atomic_add_points", { target_user_id: bet.user_id, amount_to_add: bet.potential_payout });
              await supabase.from("movements").insert({
                user_id: bet.user_id,
                type: "premio_prediccion",
                points: bet.potential_payout,
                metadata: { round_id: round.id, asset: round.asset, type: round.type, result },
              });
              await supabase.from("prediction_bets").update({ claimed: true }).eq("id", bet.id);
            }
          }
      }

      await supabase.from("prediction_rounds").update({ 
        closing_price: closePrice, 
        status: "closed" 
      }).eq("id", round.id);

      return true;
    } catch (err) {
      console.error(`[PredictResolve] Error ${round.id}:`, err);
      return false;
    }
  }));

  return results.filter(Boolean).length;
}
