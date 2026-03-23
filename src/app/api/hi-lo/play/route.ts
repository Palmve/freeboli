import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { playHiLo } from "@/lib/hilo";
import { AFFILIATE_GAME_PERCENT, MAX_WIN_POINTS, MAX_DAILY_WIN_POINTS } from "@/lib/config";
import { fetchUserLevel } from "@/lib/levels";
import { getSetting } from "@/lib/site-settings";
import { alertLargeWin, alertSuspiciousActivity } from "@/lib/telegram";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(currentUser.status)) {
    return NextResponse.json({ error: "Tu cuenta está suspendida o bloqueada." }, { status: 403 });
  }
  const userId = currentUser.id;

  // Rate-limit de sesión: 1 jugada por segundo para bloquear bots concurrentes
  const { allowed: rateLimitAllowed } = rateLimit(`hilo:${userId}`, 1, 1000);
  if (!rateLimitAllowed) {
    return NextResponse.json(
      { error: "Demasiadas jugadas en muy poco tiempo. Espera un momento." },
      { status: 429 }
    );
  }

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

  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 1.⚡ OPTIMIZACIÓN v1.082: Consultas en paralelo para reducir latencia global
  const [userLevel, maxWin, maxDailyWin, { data: todayMovements }, { count }, { data: profile }] = await Promise.all([
    fetchUserLevel(supabase, userId),
    getSetting<number>("MAX_WIN_POINTS", MAX_WIN_POINTS),
    getSetting<number>("MAX_DAILY_WIN_POINTS", MAX_DAILY_WIN_POINTS),
    supabase
      .from("movements")
      .select("points, type")
      .eq("user_id", userId)
      .in("type", ["premio_hi_lo", "apuesta_hi_lo"])
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("movements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "apuesta_hi_lo"),
    supabase
      .from("profiles")
      .select("terms_accepted_at")
      .eq("id", userId)
      .single()
  ]);

  if (!profile?.terms_accepted_at) {
    return NextResponse.json(
      { error: "Debes aceptar los terminos y condiciones antes de jugar.", requireTerms: true },
      { status: 403 }
    );
  }

  const maxBet = userLevel.benefits.maxBetPoints;
  const totalWonToday = (todayMovements ?? [])
    .filter(m => m.type === "premio_hi_lo")
    .reduce((s, m) => s + (Number(m.points) || 0), 0);
  const totalBetToday = Math.abs((todayMovements ?? [])
    .filter(m => m.type === "apuesta_hi_lo")
    .reduce((s, m) => s + (Number(m.points) || 0), 0));

  if (bet > maxBet) {
    return NextResponse.json(
      { error: `Tu nivel (${userLevel.name}) permite una apuesta máxima de ${maxBet.toLocaleString()} puntos.` },
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

  if (totalWonToday >= maxDailyWin) {
    return NextResponse.json(
      { error: `Has alcanzado el limite diario de ganancias (${maxDailyWin.toLocaleString()} pts). Vuelve manana.` },
      { status: 400 }
    );
  }

  // 2. Descuento atómico de la apuesta e incremento de contador de nivel
  const { data: subData, error: subError } = await supabase.rpc("place_hilo_bet", {
    p_user_id: userId,
    p_amount: bet,
  });

  if (subError || !subData?.[0]?.success) {
    return NextResponse.json({ 
        error: subError?.message || "Saldo insuficiente o error en la transaccion." 
    }, { status: 400 });
  }

  const balanceAfterBet = Number(subData[0].result_balance);
  const nonce = (count ?? 0) + 1;

  // 3. Jugar el resultado
  const result = playHiLo(bet, choice, odds, client_seed, nonce);
  let finalPoints = balanceAfterBet;
  const { verification } = result;

  // 4. Registrar la apuesta (Operación paralela con el premio)
  const inserts = [
    supabase.from("movements").insert({
      user_id: userId,
      type: "apuesta_hi_lo",
      points: -result.bet,
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
    })
  ];

  if (result.payout > 0) {
    // Detectar win-rate anómalo (> 5x sobre lo apostado hoy = sospecha)
    const currentWinRate = totalBetToday > 0 ? (totalWonToday + result.payout - result.bet) / totalBetToday : 0;
    if (totalBetToday > 0 && currentWinRate > 5) {
      logSecurityEvent({
        eventType: "hilo_suspicious_win_rate",
        userId,
        details: { winRate: currentWinRate.toFixed(2), totalWonToday, totalBetToday },
        severity: "high",
      }).catch(console.error);
    }

    // Acreditar premio de forma atómica y verificar límite diario
    const { data: addData, error: addError } = await supabase.rpc("atomic_add_hilo_prize", {
        p_user_id: userId,
        p_amount: result.payout,
        p_max_daily: maxDailyWin
    });

    if (addError || !addData?.[0]?.success) {
        console.warn(`[Security] Premio Hi-Lo declinado para ${userId}: ${addData?.[0]?.message || addError?.message}`);
        finalPoints = balanceAfterBet;
    } else {
        finalPoints = Number(addData[0].result_balance);
        inserts.push(
          supabase.from("movements").insert({
            user_id: userId,
            type: "premio_hi_lo",
            points: result.payout,
            metadata: { roll: result.roll, choice: result.choice },
          })
        );

        if (result.payout - result.bet >= maxWin * 0.5) {
          alertLargeWin(currentUser.email, result.bet, result.payout).catch(console.error);
        }
    }
  }

  // 5. Esperar inserciones críticas
  await Promise.all(inserts);

  // 6. 🧹 OPTIMIZACIÓN v1.082: Limpieza de historial diferida (Lazy Rollup)
  // Solo se ejecuta cada 50 jugadas para no ralentizar el juego manual/auto
  if (nonce % 50 === 0) {
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

      await supabase.from("movements").delete().in("id", oldHiLo.map((m) => m.id));
    }
  }

  // 7. Acciones secundarias (Referidos, Niveles)
  // No bloqueamos la respuesta con estas peticiones si es posible
  const finalTasks = async () => {
    try {
      const { data: ref } = await supabase.from("referrals").select("referrer_id").eq("referred_id", userId).maybeSingle();
      const gameCommPercent = await getSetting<number>("AFFILIATE_GAME_PERCENT", AFFILIATE_GAME_PERCENT);

      if (ref?.referrer_id && gameCommPercent > 0) {
        const { checkAffiliateCommissionCap } = await import("@/lib/affiliate-guard");
        const { allowed: capAllowed } = await checkAffiliateCommissionCap(supabase, ref.referrer_id);
        if (capAllowed) {
          const commission = Math.floor((bet * gameCommPercent) / 100);
          if (commission > 0) {
            await supabase.rpc("atomic_add_points", { target_user_id: ref.referrer_id, amount_to_add: commission });
            await supabase.from("movements").insert({
              user_id: ref.referrer_id,
              type: "comision_afiliado",
              points: commission,
              reference: userId,
              metadata: { source: "hi_lo", referred_user: userId, bet_amount: bet },
            });
          }
        }
      }
      const { checkAndNotifyLevelUp } = await import("@/lib/levels");
      await checkAndNotifyLevelUp(supabase, userId, currentUser.email, currentUser.name);
    } catch (e) { console.error("[Secondary Tasks Error]:", e); }
  };
  
  // Ejecutamos tareas secundarias en "segundo plano" (Next.js espera a que termine la respuesta pero nosotros enviamos el JSON antes si el runtime lo permite)
  // En este entorno, simplemente las lanzamos y retornamos el resultado.
  finalTasks();
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
