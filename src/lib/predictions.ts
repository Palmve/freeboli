import { createClient } from "@/lib/supabase/server";
import { getCryptoPrice, calculateDynamicOdds } from "./price-oracle";
import { getSetting } from "./site-settings";

export type PredictionAsset = "BTC" | "SOL" | "BOLIS";

/**
 * Asegura que exista una ronda activa para el asset dado en la hora actual.
 */
export async function ensureActiveRound(asset: PredictionAsset) {
  const supabase = await createClient();
  const now = new Date();
  
  // Calcular inicio y fin de la hora actual
  const startTime = new Date(now);
  startTime.setMinutes(0, 0, 0);
  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + 1);

  // Buscar si ya existe
  const { data: existing } = await supabase
    .from("prediction_rounds")
    .select("*")
    .eq("asset", asset)
    .eq("start_time", startTime.toISOString())
    .single();

  if (existing) return existing;

  // Si no existe, crearla obteniendo el precio actual como precio de apertura
  let openPrice = await getCryptoPrice(asset);
  if (openPrice === null) return null;

  // Asegurar 4 decimales para BOLIS al grabar
  if (asset === "BOLIS") {
    openPrice = Number(openPrice.toFixed(4));
  }

  const { data: newRound, error } = await supabase
    .from("prediction_rounds")
    .insert({
      asset,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      opening_price: openPrice,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating prediction round:", error);
    return null;
  }
  return newRound;
}

/**
 * Obtiene la ronda activa y calcula las cuotas actuales.
 */
export async function getActiveRoundWithOdds(asset: PredictionAsset) {
  const round = await ensureActiveRound(asset);
  if (!round) return { error: "No se pudo asegurar o crear una ronda activa." };
  if (round.status !== "open") return { error: `La ronda actual para ${asset} no está abierta (status: ${round.status}).` };

  const currentPrice = await getCryptoPrice(asset);
  if (currentPrice === null) return { error: `Error al obtener el precio actual de ${asset}. Reintenta en unos segundos.` };

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
 * Procesa la resolución de rondas terminadas.
 */
export async function resolvePendingRounds() {
  const supabase = await createClient();
  const now = new Date();

  // Buscar rondas que no estén resueltas ni canceladas cuyo end_time ya pasó
  const { data: pending } = await supabase
    .from("prediction_rounds")
    .select("*")
    .neq("status", "resolved")
    .neq("status", "cancelled")
    .lt("end_time", now.toISOString());

  if (!pending || pending.length === 0) return 0;

  // Procesar rondas en paralelo para evitar latencia acumulada
  const results = await Promise.all(pending.map(async (round) => {
    try {
      let finalPrice = await getCryptoPrice(round.asset as PredictionAsset);
      if (finalPrice === null) return false;

      // Asegurar 4 decimales para BOLIS al grabar
      if (round.asset === "BOLIS") {
        finalPrice = Number(finalPrice.toFixed(4));
      }

      const isDraw = finalPrice === round.opening_price;
      const result = finalPrice > round.opening_price ? "up" : "down";

      // 1. Actualizar ronda
      const { error: updateError } = await supabase
        .from("prediction_rounds")
        .update({
          closing_price: finalPrice,
          status: "resolved",
        })
        .eq("id", round.id);
      
      if (updateError) throw updateError;

      // 2. Liquidar apuestas
      if (isDraw) {
        const { data: allBets } = await supabase
          .from("prediction_bets")
          .select("*")
          .eq("round_id", round.id)
          .eq("claimed", false);
        
        if (allBets) {
          for (const bet of allBets) {
            const { data: balance } = await supabase.from("balances").select("points").eq("user_id", bet.user_id).single();
            const newPoints = Number(balance?.points ?? 0) + Number(bet.amount);
            await supabase.from("balances").upsert({ user_id: bet.user_id, points: newPoints, updated_at: new Date().toISOString() });
            await supabase.from("movements").insert({
              user_id: bet.user_id,
              type: "premio_prediccion",
              points: bet.amount,
              metadata: { round_id: round.id, asset: round.asset, result: "draw", note: "Devolución por empate" },
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
            const { data: balance } = await supabase.from("balances")
              .select("points").eq("user_id", bet.user_id).single();
            const newPoints = Number(balance?.points ?? 0) + Number(bet.potential_payout);
            await supabase.from("balances").upsert({ user_id: bet.user_id, points: newPoints, updated_at: new Date().toISOString() });
            await supabase.from("movements").insert({
              user_id: bet.user_id,
              type: "premio_prediccion",
              points: bet.potential_payout,
              metadata: { round_id: round.id, asset: round.asset, result },
            });
            await supabase.from("prediction_bets").update({ claimed: true }).eq("id", bet.id);
          }
        }
      }
      return true;
    } catch (e) {
      console.error(`Error resolving round ${round.id}:`, e);
      return false;
    }
  }));

  return results.filter(Boolean).length;
}
