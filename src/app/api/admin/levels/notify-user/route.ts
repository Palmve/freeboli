import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";
import { getUserLevel, getNextLevel, getLevelProgress, LEVELS } from "@/lib/levels";
import { sendEmailViaResend } from "@/lib/resend";
import { getLevelCardEmail } from "@/lib/mail-templates";

/**
 * POST /api/admin/levels/notify-user
 * Envía manualmente el correo de tarjeta de nivel a un usuario específico.
 * Body: { userId: string }
 */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { userId } = await req.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: "userId requerido." }, { status: 400 });

  const supabase = await createClient();

  const { data: p } = await supabase
    .from("profiles")
    .select("email, name, hilo_bet_count, faucet_claim_count, prediction_count, email_verified_at, created_at")
    .eq("id", userId)
    .single();

  if (!p?.email) return NextResponse.json({ error: "Usuario no encontrado o sin email." }, { status: 404 });

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

  // Calcular XP %
  let xpPercent = 100;
  if (nextLevel) {
    const prog = getLevelProgress(stats, nextLevel);
    const vals = [prog.bets, prog.faucet];
    if (nextLevel.minPredictions > 0) vals.push(prog.predictions);
    if (nextLevel.minDaysSinceJoined > 0) vals.push(prog.days);
    xpPercent = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
  }

  const benefits = [
    `Apuesta máxima: ${currentLevel.benefits.maxBetPoints.toLocaleString()} puntos`,
    `Retiro máximo: ${currentLevel.benefits.maxWithdrawBolis} BOLIS`,
  ];

  try {
    await sendEmailViaResend({
      to: p.email,
      subject: `${currentLevel.icon} Tu estado en FreeBoli: Nivel ${currentLevel.name}`,
      html: getLevelCardEmail({
        userName: p.name || p.email.split('@')[0],
        levelLevel: currentLevel.level,
        levelName: currentLevel.name,
        levelIcon: currentLevel.icon,
        xpPercent,
        maxBetPoints: currentLevel.benefits.maxBetPoints,
        maxWithdrawBolis: currentLevel.benefits.maxWithdrawBolis,
        rewardPoints: 0,
        nextLevelName: nextLevel?.name,
        nextLevelIcon: nextLevel?.icon,
        benefits,
      }),
    });

    return NextResponse.json({ ok: true, email: p.email, level: currentLevel.name });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
