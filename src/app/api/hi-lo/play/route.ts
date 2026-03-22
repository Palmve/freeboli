import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { playHiLo } from "@/lib/hilo";
import { AFFILIATE_GAME_PERCENT, MAX_BET_POINTS, MAX_WIN_POINTS, MAX_DAILY_WIN_POINTS } from "@/lib/config";
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

  // 1. Descuento atómico de la apuesta (Evita Race Condition)
  const { data: subData, error: subError } = await supabase.rpc("atomic_subtract_points", {
    target_user_id: userId,
    amount_to_subtract: bet,
  });

  if (subError || !subData?.[0]?.success) {
    return NextResponse.json({ 
        error: subError?.message || "Saldo insuficiente o error en la transaccion." 
    }, { status: 400 });
  }

  const balanceAfterBet = Number(subData[0].result_balance);

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
  let finalPoints = balanceAfterBet;
  const { verification } = result;
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
    // 2. Acreditar premio de forma atómica y verificar límite diario
    const { data: addData, error: addError } = await supabase.rpc("atomic_add_hilo_prize", {
        p_user_id: userId,
        p_amount: result.payout,
        p_max_daily: maxDailyWin
    });

    if (addError || !addData?.[0]?.success) {
        // Si el premio no se pudo acreditar (ej: límite diario), no registramos el movimiento de premio
        // El usuario ya perdió su apuesta en el paso 1. Esto es correcto para evitar abusos.
        console.warn(`[Security] Premio Hi-Lo declinado para ${userId}: ${addData?.[0]?.message || addError?.message}`);
        finalPoints = balanceAfterBet; // El balance sigue siendo el de después de la apuesta
    } else {
        finalPoints = Number(addData[0].result_balance);

        await supabase.from("movements").insert({
          user_id: userId,
          type: "premio_hi_lo",
          points: result.payout,
          reference: null,
          metadata: { roll: result.roll, choice: result.choice },
        });

        const winAmount = result.payout - result.bet;
        if (winAmount >= maxWin * 0.5) {
          await alertLargeWin(currentUser.email, result.bet, result.payout);
        }

        // Alerta de límite (informativa)
        // Nota: El límite ya fue verificado por el RPC, aquí solo alertamos si estamos cerca
        if (finalPoints >= maxDailyWin * 0.8) {
           // (Opcional) Podemos alertar aquí
        }
    }
  }

  // Mantener solo las últimas 100 jugadas HI-LO por usuario (apuestas + premios)
  const { data: oldHiLo } = await supabase
    .from("movements")
    .select("id, points, type, created_at")
    .eq("user_id", userId)
    .in("type", ["apuesta_hi_lo", "premio_hi_lo"])
    .order("created_at", { ascending: false })
    .range(100, 1000);

  if (oldHiLo && oldHiLo.length > 0) {
    const groupedByDay: Record<string, { pointsBet: number, pointsWon: number, countBet: number, countWon: number, ids: string[] }> = {};
    
    for (const m of oldHiLo) {
        const day = m.created_at.split("T")[0];
        if (!groupedByDay[day]) groupedByDay[day] = { pointsBet: 0, pointsWon: 0, countBet: 0, countWon: 0, ids: [] };
        
        groupedByDay[day].ids.push(m.id);
        if (m.type === "apuesta_hi_lo") {
            groupedByDay[day].pointsBet += Number(m.points);
            groupedByDay[day].countBet++;
        }
        if (m.type === "premio_hi_lo") {
            groupedByDay[day].pointsWon += Number(m.points);
            groupedByDay[day].countWon++;
        }
    }

    for (const [day, group] of Object.entries(groupedByDay)) {
        if (group.pointsBet !== 0) {
            await supabase.from("movements").insert({
                user_id: userId,
                type: "apuesta_hi_lo",
                points: group.pointsBet,
                created_at: `${day}T23:59:59.000Z`,
                reference: "agrupacion_" + day,
                metadata: { rollup_count: group.countBet }
            });
        }
        if (group.pointsWon !== 0) {
            await supabase.from("movements").insert({
                user_id: userId,
                type: "premio_hi_lo",
                points: group.pointsWon,
                created_at: `${day}T23:59:59.000Z`,
                reference: "agrupacion_premio_" + day,
                metadata: { rollup_count: group.countWon }
            });
        }
    }

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

  const gameCommPercent = await getSetting<number>("AFFILIATE_GAME_PERCENT", AFFILIATE_GAME_PERCENT);

  if (ref?.referrer_id && gameCommPercent > 0) {
    const commission = Math.floor((bet * gameCommPercent) / 100);
    if (commission > 0) {
      // Acreditar comisión de afiliado de forma atómica
      await supabase.rpc("atomic_add_points", {
          target_user_id: ref.referrer_id,
          amount_to_add: commission
      });

      await supabase.from("movements").insert({
        user_id: ref.referrer_id,
        type: "comision_afiliado",
        points: commission,
        reference: userId,
        metadata: { source: "hi_lo", referred_user: userId, bet_amount: bet },
      });
    }
  }

  return NextResponse.json({
    roll: result.roll,
    choice: result.choice,
    win: result.win,
    bet: result.bet,
    payout: result.payout,
    newBalance: finalPoints,
    verification: {
      server_seed: verification.server_seed,
      server_seed_hash: verification.server_seed_hash,
      client_seed: verification.client_seed,
      nonce: verification.nonce,
    },
  });
}
