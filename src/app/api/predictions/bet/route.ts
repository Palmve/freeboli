import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { getActiveRoundWithOdds, PredictionAsset, resolvePendingRounds } from "@/lib/predictions";
import { getSetting } from "@/lib/site-settings";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(user.status)) return NextResponse.json({ error: "Cuenta bloqueada." }, { status: 403 });

  // El cron master (/api/cron/master) se encarga de resolver las rondas pendientes cada minuto.
  // Se elimina la llamada síncrona aquí para optimizar el rendimiento y evitar latencia en apuestas.

  const body = await req.json().catch(() => ({}));
  const asset = (body.asset?.toUpperCase() as PredictionAsset) || "BTC";
  const type = body.type === "mini" ? "mini" : body.type === "micro" ? "micro" : "hourly";
  
  let prediction = null;
  if (type === "micro") {
    if (typeof body.prediction === "string" && /^[0-9]$/.test(body.prediction)) {
        prediction = body.prediction;
    }
  } else {
    if (body.prediction === "up" || body.prediction === "down") {
        prediction = body.prediction;
    }
  }
  const amount = Math.floor(Number(body.amount));

  if (!prediction || amount < 1) {
    return NextResponse.json({ error: "Datos de apuesta inválidos." }, { status: 400 });
  }

  const minBet = await getSetting<number>("PREDICTION_MIN_BET", 10);
  const maxBetKey = `${asset}_MAX_BET`;
  const maxBet = await getSetting<number>(maxBetKey, 100000);
  
  // Cutoff dinámico: 10 min rounds (60s defecto), 1 hour (600s defecto), micro (60s)
  let cutoffKey = "PREDICTION_CUTOFF_SECONDS";
  let cutoffDefault = 600;

  if (type === "mini") {
    cutoffKey = "PREDICTION_CUTOFF_MINI";
    cutoffDefault = 120;
  } else if (type === "micro") {
    cutoffKey = "PREDICTION_CUTOFF_MICRO";
    cutoffDefault = 60;
  }
  
  const cutoff = await getSetting<number>(cutoffKey, cutoffDefault);

  if (amount < minBet || amount > maxBet) {
    return NextResponse.json({ error: `Apuesta fuera de límites (${minBet}-${maxBet}).` }, { status: 400 });
  }

  const roundData: any = await getActiveRoundWithOdds(asset, type);
  if (roundData?.error) return NextResponse.json({ error: roundData.error }, { status: 404 });

  if (roundData.time_left_sec <= cutoff) {
    return NextResponse.json({ error: "Las apuestas para esta ronda están cerradas." }, { status: 400 });
  }

  // --- ANTI-FRAUDE MICRO ---
  // No se puede apostar al último dígito exacto actual
  if (type === "micro") {
      const currentLastDigit = String(roundData.current_price).slice(-1);
      if (prediction === currentLastDigit) {
          return NextResponse.json({ error: "El Oráculo declinó la operación: El número " + prediction + " está bloqueado en este milisegundo." }, { status: 400 });
      }
  }

  const odds = type === "micro" ? roundData.odds.micro : roundData.odds[prediction as "up" | "down"];
  if (odds === 0) return NextResponse.json({ error: "Las apuestas están cerradas temporalmente." }, { status: 400 });
  const potentialPayout = Math.floor(amount * odds);

  const supabase = await createClient();

  // Verificar límite de 5 apuestas máximas por ronda para este usuario
  const { count: userBetCount, error: countError } = await supabase
    .from("prediction_bets")
    .select("*", { count: "exact", head: true })
    .eq("round_id", roundData.id)
    .eq("user_id", user.id);

  if (countError) {
    return NextResponse.json({ error: "Error al verificar tu historial de apuestas." }, { status: 500 });
  }

  if (userBetCount !== null && userBetCount >= 5) {
    return NextResponse.json({ error: "Límite alcanzado: Solo se permiten 5 apuestas por ronda." }, { status: 400 });
  }

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
