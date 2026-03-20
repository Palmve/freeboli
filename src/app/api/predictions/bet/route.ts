import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { getActiveRoundWithOdds, PredictionAsset, resolvePendingRounds } from "@/lib/predictions";
import { getSetting } from "@/lib/site-settings";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(user.status)) return NextResponse.json({ error: "Cuenta bloqueada." }, { status: 403 });

  // Sustituye el cron de resolución: antes de apostar, liquida rondas vencidas.
  await resolvePendingRounds().catch(() => {});

  const body = await req.json().catch(() => ({}));
  const asset = (body.asset?.toUpperCase() as PredictionAsset) || "BTC";
  const type = body.type === "mini" ? "mini" : "hourly";
  const prediction = body.prediction === "up" || body.prediction === "down" ? body.prediction : null;
  const amount = Math.floor(Number(body.amount));

  if (!prediction || amount < 1) {
    return NextResponse.json({ error: "Datos de apuesta invalidos." }, { status: 400 });
  }

  const minBet = await getSetting<number>("PREDICTION_MIN_BET", 10);
  const maxBetKey = `${asset}_MAX_BET`;
  const maxBet = await getSetting<number>(maxBetKey, 10000);
  
  // Cutoff dinámico: 10 min rounds (120s defecto), 1 hour (600s defecto)
  const cutoffKey = type === "mini" ? "PREDICTION_CUTOFF_MINI" : "PREDICTION_CUTOFF_SECONDS";
  const cutoffLimit = type === "mini" ? 120 : 600;
  const cutoff = await getSetting<number>(cutoffKey, cutoffLimit);

  if (amount < minBet || amount > maxBet) {
    return NextResponse.json({ error: `Apuesta fuera de limites (${minBet}-${maxBet}).` }, { status: 400 });
  }

  const roundData: any = await getActiveRoundWithOdds(asset, type);
  if (roundData?.error) return NextResponse.json({ error: roundData.error }, { status: 404 });

  if (roundData.time_left_sec <= cutoff) {
    return NextResponse.json({ error: "Las apuestas para esta ronda estan cerradas." }, { status: 400 });
  }

  const odds = roundData.odds[prediction];
  const potentialPayout = Math.floor(amount * odds);

  const supabase = await createClient();

  // 1. Descuento atómico de la apuesta (Evita Race Condition)
  const { data: subData, error: subError } = await supabase.rpc("atomic_subtract_points", {
    target_user_id: user.id,
    amount_to_subtract: amount,
  });

  if (subError || !subData?.[0]?.success) {
    return NextResponse.json({ 
        error: subError?.message || "Saldo insuficiente o error en la transaccion." 
    }, { status: 400 });
  }

  const newPoints = Number(subData[0].result_balance);

  await supabase.from("movements").insert({
    user_id: user.id,
    type: "apuesta_prediccion",
    points: -amount,
    metadata: { round_id: roundData.id, asset, type, prediction, odds },
  });

  const { data: bet, error } = await supabase
    .from("prediction_bets")
    .insert({
      round_id: roundData.id,
      user_id: user.id,
      type,
      amount,
      prediction,
      odds_at_bet: odds,
      potential_payout: potentialPayout,
    })
    .select()
    .single();

  if (error) {
    console.error("Error inserting bet:", error);
    return NextResponse.json({ error: "Error al registrar la apuesta." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    bet,
    newBalance: newPoints,
  });
}
