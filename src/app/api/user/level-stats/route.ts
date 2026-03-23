import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { getUserLevel, getNextLevel, getLevelProgress, LEVELS } from "@/lib/levels";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(user.status)) return NextResponse.json({ error: "Bloqueado." }, { status: 403 });

  const supabase = await createClient();

  const { data: p } = await supabase
    .from("profiles")
    .select("hilo_bet_count, faucet_claim_count, prediction_count, email_verified_at, created_at")
    .eq("id", user.id)
    .single();

  if (!p) return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });

  const daysSinceJoined = p.created_at
    ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
    : 0;

  const stats = {
    betCount: p.hilo_bet_count ?? 0,
    faucetClaims: p.faucet_claim_count ?? 0,
    predictionCount: p.prediction_count ?? 0,
    daysSinceJoined,
    emailVerified: !!p.email_verified_at,
  };

  const currentLevel = getUserLevel(stats);
  const nextLevel = getNextLevel(currentLevel);

  // Calcular XP global: promedio ponderado de las métricas necesarias para el SIGUIENTE nivel
  let xpPercent = 100;
  if (nextLevel) {
    const prog = getLevelProgress(stats, nextLevel);
    const metricValues = [prog.bets, prog.faucet];
    if (nextLevel.minPredictions > 0) metricValues.push(prog.predictions);
    if (nextLevel.minDaysSinceJoined > 0) metricValues.push(prog.days);
    xpPercent = Math.round((metricValues.reduce((a, b) => a + b, 0) / metricValues.length) * 100);
  }

  return NextResponse.json({
    ...stats,
    currentLevel,
    nextLevel,
    xpPercent,
    levels: LEVELS,
    maxBetPoints: currentLevel.benefits.maxBetPoints,
    maxWithdrawBolis: currentLevel.benefits.maxWithdrawBolis,
    rewardPoints: currentLevel.rewardPoints,
  });
}
