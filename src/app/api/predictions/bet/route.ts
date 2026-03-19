import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { getActiveRoundWithOdds, PredictionAsset } from "@/lib/predictions";
import { getSetting } from "@/lib/site-settings";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(user.status)) return NextResponse.json({ error: "Cuenta bloqueada." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const asset = (body.asset?.toUpperCase() as PredictionAsset) || "BTC";
  const prediction = body.prediction === "up" || body.prediction === "down" ? body.prediction : null;
  const amount = Math.floor(Number(body.amount));

  if (!prediction || amount < 1) {
    return NextResponse.json({ error: "Datos de apuesta invalidos." }, { status: 400 });
  }

  const minBet = await getSetting<number>("PREDICTION_MIN_BET", 10);
  const maxBetKey = `${asset}_MAX_BET`;
  const maxBet = await getSetting<number>(maxBetKey, 10000);
  const cutoff = await getSetting<number>("PREDICTION_CUTOFF_SECONDS", 600);

  if (amount < minBet || amount > maxBet) {
    return NextResponse.json({ error: `Apuesta fuera de limites (${minBet}-${maxBet}).` }, { status: 400 });
  }

  const roundData = await getActiveRoundWithOdds(asset);
  if (!roundData) return NextResponse.json({ error: "No hay ronda activa." }, { status: 404 });

  if (roundData.time_left_sec <= cutoff) {
    return NextResponse.json({ error: "Las apuestas para esta ronda estan cerradas." }, { status: 400 });
  }

  const odds = roundData.odds[prediction];
  const potentialPayout = Math.floor(amount * odds);

  const supabase = await createClient();

  // 1. Verificar balance
  const { data: balance } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", user.id)
    .single();

  if (Number(balance?.points ?? 0) < amount) {
    return NextResponse.json({ error: "Saldo insuficiente." }, { status: 400 });
  }

  // 2. Ejecutar apuesta (Descontar saldo y registrar apuesta)
  const newPoints = Number(balance?.points) - amount;

  await supabase.from("balances").upsert({
    user_id: user.id,
    points: newPoints,
    updated_at: new Date().toISOString(),
  });

  await supabase.from("movements").insert({
    user_id: user.id,
    type: "apuesta_prediccion",
    points: -amount,
    metadata: { round_id: roundData.id, asset, prediction, odds },
  });

  const { data: bet, error } = await supabase
    .from("prediction_bets")
    .insert({
      round_id: roundData.id,
      user_id: user.id,
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
