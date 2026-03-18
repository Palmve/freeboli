import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { playHiLo } from "@/lib/hilo";
import { AFFILIATE_COMMISSION_PERCENT, MAX_BET_POINTS, MAX_WIN_POINTS, MAX_DAILY_WIN_POINTS } from "@/lib/config";
import { getSetting } from "@/lib/site-settings";
import { alertLargeWin, alertDailyLimitReached } from "@/lib/telegram";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(currentUser.status)) {
    return NextResponse.json({ error: "Tu cuenta está suspendida o bloqueada." }, { status: 403 });
  }
  const userId = currentUser.id;

  const body = await req.json().catch(() => ({}));
  const bet = Math.floor(Number(body.bet));
  const choice = body.choice === "hi" || body.choice === "lo" ? body.choice : null;
  const client_seed = typeof body.client_seed === "string" ? body.client_seed : undefined;
  let odds = Number(body.odds);
  if (!Number.isFinite(odds) || odds < 1.01 || odds > 4900) odds = 2;
  if (!choice || bet < 1) {
    return NextResponse.json(
      { error: "Apuesta invalida (minimo 1 punto) y eleccion hi o lo." },
      { status: 400 }
    );
  }

  const maxBet = await getSetting<number>("MAX_BET_POINTS", MAX_BET_POINTS);
  const maxWin = await getSetting<number>("MAX_WIN_POINTS", MAX_WIN_POINTS);
  const maxDailyWin = await getSetting<number>("MAX_DAILY_WIN_POINTS", MAX_DAILY_WIN_POINTS);

  if (bet > maxBet) {
    return NextResponse.json(
      { error: `Apuesta maxima: ${maxBet.toLocaleString()} puntos.` },
      { status: 400 }
    );
  }

  const potentialWin = Math.floor(bet * odds) - bet;
  if (potentialWin > maxWin) {
    return NextResponse.json(
      { error: `Ganancia maxima por jugada: ${maxWin.toLocaleString()} puntos. Reduce tu apuesta o la cuota.` },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Check daily win cap
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todayWins } = await supabase
    .from("movements")
    .select("points")
    .eq("user_id", userId)
    .eq("type", "premio_hi_lo")
    .gte("created_at", todayStart.toISOString());
  const totalWonToday = (todayWins ?? []).reduce((s, m) => s + (Number(m.points) || 0), 0);
  if (totalWonToday >= maxDailyWin) {
    return NextResponse.json(
      { error: `Has alcanzado el limite diario de ganancias (${maxDailyWin.toLocaleString()} pts). Vuelve manana.` },
      { status: 400 }
    );
  }

  const { data: balanceRow } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", userId)
    .single();
  const currentPoints = Number(balanceRow?.points ?? 0);
  if (currentPoints < bet) {
    return NextResponse.json({ error: "Saldo insuficiente." }, { status: 400 });
  }

  // Check terms acceptance
  const { data: profile } = await supabase
    .from("profiles")
    .select("terms_accepted_at")
    .eq("id", userId)
    .single();
  if (!profile?.terms_accepted_at) {
    return NextResponse.json(
      { error: "Debes aceptar los terminos y condiciones antes de jugar.", requireTerms: true },
      { status: 403 }
    );
  }

  const { count } = await supabase
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "apuesta_hi_lo");
  const nonce = (count ?? 0) + 1;

  const result = playHiLo(bet, choice, odds, client_seed, nonce);
  const newPoints = currentPoints - result.bet + result.payout;
  const { verification } = result;

  await supabase.from("balances").upsert(
    { user_id: userId, points: newPoints, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  await supabase.from("movements").insert({
    user_id: userId,
    type: "apuesta_hi_lo",
    points: -result.bet,
    reference: null,
    metadata: {
      choice: result.choice,
      roll: result.roll,
      win: result.win,
      payout: result.payout,
      server_seed: verification.server_seed,
      server_seed_hash: verification.server_seed_hash,
      client_seed: verification.client_seed,
      nonce: verification.nonce,
    },
  });
  if (result.payout > 0) {
    await supabase.from("movements").insert({
      user_id: userId,
      type: "premio_hi_lo",
      points: result.payout,
      reference: null,
      metadata: { roll: result.roll, choice: result.choice },
    });

    const winAmount = result.payout - result.bet;
    if (winAmount >= maxWin * 0.5) {
      alertLargeWin(currentUser.email, result.bet, result.payout);
    }

    const newTotalWon = totalWonToday + result.payout;
    if (newTotalWon >= maxDailyWin * 0.8) {
      alertDailyLimitReached(currentUser.email, newTotalWon);
    }
  }

  // Mantener solo las últimas 100 jugadas HI-LO por usuario (apuestas + premios)
  const { data: oldHiLo } = await supabase
    .from("movements")
    .select("id")
    .eq("user_id", userId)
    .in("type", ["apuesta_hi_lo", "premio_hi_lo"])
    .order("created_at", { ascending: false })
    .range(100, 1000);
  if (oldHiLo && oldHiLo.length > 0) {
    await supabase
      .from("movements")
      .delete()
      .in(
        "id",
        oldHiLo.map((m) => m.id)
      );
  }

  const { data: ref } = await supabase
    .from("referrals")
    .select("referrer_id")
    .eq("referred_id", userId)
    .single();
  if (ref?.referrer_id && AFFILIATE_COMMISSION_PERCENT > 0 && result.payout > 0) {
    const commission = Math.floor((result.payout * AFFILIATE_COMMISSION_PERCENT) / 100);
    if (commission > 0) {
      const { data: refBalance } = await supabase
        .from("balances")
        .select("points")
        .eq("user_id", ref.referrer_id)
        .single();
      const refNew = Number(refBalance?.points ?? 0) + commission;
      await supabase.from("balances").upsert(
        { user_id: ref.referrer_id, points: refNew, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      await supabase.from("movements").insert({
        user_id: ref.referrer_id,
        type: "comision_afiliado",
        points: commission,
        reference: userId,
        metadata: { source: "hi_lo", referred_user: userId },
      });
    }
  }

  return NextResponse.json({
    roll: result.roll,
    choice: result.choice,
    win: result.win,
    bet: result.bet,
    payout: result.payout,
    newBalance: newPoints,
    verification: {
      server_seed: verification.server_seed,
      server_seed_hash: verification.server_seed_hash,
      client_seed: verification.client_seed,
      nonce: verification.nonce,
    },
  });
}
