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
  const openPrice = await getCryptoPrice(asset);
  if (openPrice === null) return null;

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
  if (!round || round.status !== "open") return null;

  const currentPrice = await getCryptoPrice(asset);
  if (currentPrice === null) return null;

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

  for (const round of pending) {
    const finalPrice = await getCryptoPrice(round.asset as PredictionAsset);
    if (finalPrice === null) continue;

    const isDraw = finalPrice === round.opening_price;
    const result = finalPrice > round.opening_price ? "up" : "down";

    // 1. Actualizar ronda (marcar como liquidando para evitar doble procesamiento si falla a mitad)
    const { error: updateError } = await supabase
      .from("prediction_rounds")
      .update({
        closing_price: finalPrice,
        status: "resolved",
      })
      .eq("id", round.id);
    
    if (updateError) {
      console.error(`Error resolving round ${round.id}:`, updateError);
      continue;
    }

    if (isDraw) {
      // Caso Empate: Devolver a todos
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
      continue;
    }

    // 2. Buscar apuestas ganadoras (solo si no fue empate)
    const { data: winningBets } = await supabase
      .from("prediction_bets")
      .select("*")
      .eq("round_id", round.id)
      .eq("prediction", result)
      .eq("claimed", false);

    if (winningBets) {
      for (const bet of winningBets) {
        // Pagar premio
        const { data: balance } = await supabase
          .from("balances")
          .select("points")
          .eq("user_id", bet.user_id)
          .single();
        
        const newPoints = Number(balance?.points ?? 0) + Number(bet.potential_payout);
        
        await supabase.from("balances").upsert({
          user_id: bet.user_id,
          points: newPoints,
          updated_at: new Date().toISOString(),
        });

        await supabase.from("movements").insert({
          user_id: bet.user_id,
          type: "premio_prediccion",
          points: bet.potential_payout,
          metadata: { round_id: round.id, asset: round.asset, result },
        });

        await supabase
          .from("prediction_bets")
          .update({ claimed: true })
          .eq("id", bet.id);
      }
    }
  }

  return pending.length;
}
