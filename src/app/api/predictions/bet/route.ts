import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { getActiveRoundWithOdds, PredictionAsset } from "@/lib/predictions";
import { getSetting } from "@/lib/site-settings";
import { AFFILIATE_GAME_PERCENT, MAX_WIN_POINTS } from "@/lib/config";
import { fetchUserLevel } from "@/lib/levels";
import { rateLimit } from "@/lib/rate-limit";
import { persistentRateLimit, logSecurityEvent } from "@/lib/security";

const VALID_ASSETS = ["BTC", "SOL", "BOLIS"] as const;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(user.status)) return NextResponse.json({ error: "Cuenta bloqueada." }, { status: 403 });

  const supabase = await createClient();
  const userLevel = await fetchUserLevel(supabase, user.id);

  // Rate-limit capa 1: in-memory (3 apuestas por segundo)
  const { allowed: rlAllowed } = rateLimit(`pred:${user.id}`, 3, 1000);
  if (!rlAllowed) {
    return NextResponse.json({ error: "Demasiadas apuestas. Espera un momento." }, { status: 429 });
  }

  // Rate-limit capa 2: persistente (30 apuestas por minuto, anti-bot cross-worker)
  const { allowed: pAllowed } = await persistentRateLimit(`pred:${user.id}`, 30, 60_000);
  if (!pAllowed) {
    await logSecurityEvent({
      eventType: "prediction_rate_limit_persistent",
      userId: user.id,
      details: { note: "Excedió 30 apuestas/min — posible bot" },
      severity: "high",
    }).catch(console.error);
    return NextResponse.json({ error: "Has alcanzado el límite de apuestas por minuto." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));

  // Validación estricta de asset
  const rawAsset = body.asset?.toUpperCase();
  if (!VALID_ASSETS.includes(rawAsset)) {
    return NextResponse.json({ error: "Asset no soportado." }, { status: 400 });
  }
  const asset = rawAsset as PredictionAsset;
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

  const minBet = await getSetting<number>("PREDICTION_MIN_BET", 1);
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
      const { getPredictionMicroDigit } = await import("@/lib/predictions");
      const currentLastDigit = getPredictionMicroDigit(roundData.current_price, asset);
      if (prediction === currentLastDigit) {
          return NextResponse.json({ error: "El Oráculo declinó la operación: El número " + prediction + " está bloqueado en este milisegundo." }, { status: 400 });
      }
  }

  const odds = type === "micro" ? roundData.odds.micro : roundData.odds[prediction as "up" | "down"];
  if (odds === 0) return NextResponse.json({ error: "Las apuestas están cerradas temporalmente." }, { status: 400 });
  const potentialPayout = Math.floor(amount * odds);

  // Verificar ganancia máxima por jugada
  const maxWin = await getSetting<number>("MAX_WIN_POINTS", MAX_WIN_POINTS);
  if (potentialPayout - amount > maxWin) {
    return NextResponse.json(
      { error: `Ganancia potencial excede el límite (${maxWin.toLocaleString()} pts). Reduce tu apuesta.` },
      { status: 400 }
    );
  }

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

  // --- Afiliados: Comisión (aislada en try/catch para no interrumpir la apuesta) ---
  try {
    const { data: ref } = await supabase
      .from("referrals")
      .select("referrer_id")
      .eq("referred_id", user.id)
      .single();

    const gameCommPercent = await getSetting<number>("AFFILIATE_GAME_PERCENT", AFFILIATE_GAME_PERCENT);

    if (ref?.referrer_id && gameCommPercent > 0) {
      const { checkAffiliateCommissionCap } = await import("@/lib/affiliate-guard");
      const { allowed: capAllowed } = await checkAffiliateCommissionCap(supabase, ref.referrer_id);
      if (capAllowed) {
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
    }
  } catch (e) {
    console.error("[Prediction Affiliate Commission Error]:", e);
  }

  const { checkAndNotifyLevelUp } = await import("@/lib/levels");
  await checkAndNotifyLevelUp(supabase, user.id, user.email, user.name);

  return NextResponse.json({
    success: true,
    newBalance: newPoints,
  });
}
