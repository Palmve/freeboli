import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { getActiveRoundWithOdds, PredictionAsset, resolvePendingRounds } from "@/lib/predictions";
import { getSetting } from "@/lib/site-settings";
import { AFFILIATE_GAME_PERCENT, MAX_WIN_POINTS } from "@/lib/config";
import { fetchUserLevel } from "@/lib/levels";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(user.status)) return NextResponse.json({ error: "Cuenta bloqueada." }, { status: 403 });

  const supabase = await createClient();
  const userLevel = await fetchUserLevel(supabase, user.id);

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
  const maxBet = userLevel.benefits.maxBetPoints;
  
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

  // ... (supabase ya está creado arriba)

  // 1. Ejecutar apuesta de forma atómica (Verifica saldo y límite de 5 apuestas por ronda)
  const { data: betResult, error: betError } = await supabase.rpc("place_prediction_bet", {
    p_user_id: user.id,
    p_round_id: roundData.id,
    p_amount: amount,
    p_prediction: prediction,
    p_type: type,
    p_odds: odds,
    p_payout: potentialPayout
  });

  if (betError || !betResult?.[0]?.success) {
    return NextResponse.json({ 
        error: betResult?.[0]?.message || betError?.message || "Error al procesar la apuesta." 
    }, { status: 400 });
  }

  const newPoints = Number(betResult[0].result_balance);

  // --- Afiliados: Comisión del 2% de la apuesta ---
  const { data: ref } = await supabase
    .from("referrals")
    .select("referrer_id")
    .eq("referred_id", user.id)
    .single();

  const gameCommPercent = await getSetting<number>("AFFILIATE_GAME_PERCENT", AFFILIATE_GAME_PERCENT);

  if (ref?.referrer_id && gameCommPercent > 0) {
    const commission = Math.floor((amount * gameCommPercent) / 100);
    if (commission > 0) {
      await supabase.rpc("atomic_add_points", {
        target_user_id: ref.referrer_id,
        amount_to_add: commission
      });

      await supabase.from("movements").insert({
        user_id: ref.referrer_id,
        type: "comision_afiliado",
        points: commission,
        reference: user.id,
        metadata: { source: "prediction", referred_user: user.id, bet_amount: amount, round_id: roundData.id },
      });
    }
  }

  const { checkAndNotifyLevelUp } = await import("@/lib/levels");
  await checkAndNotifyLevelUp(supabase, user.id, user.email, user.name);

  return NextResponse.json({
    success: true,
    newBalance: newPoints,
  });
}
