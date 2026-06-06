import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { settleHiLo, rollFromSeeds, hiLoWinningOutcomes, hiLoEffectiveOdds, hiLoMinBet, generateServerSeed, generateClientSeed } from "@/lib/hilo";
import { createAdminClient } from "@/lib/supabase/admin";
import { AFFILIATE_GAME_PERCENT, MAX_WIN_POINTS, MAX_DAILY_WIN_POINTS } from "@/lib/config";
import { fetchUserLevel } from "@/lib/levels";
import { getSetting } from "@/lib/site-settings";
import { alertLargeWin, alertSuspiciousActivity } from "@/lib/telegram";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent, persistentRateLimit } from "@/lib/security";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(currentUser.status)) {
    return NextResponse.json({ error: "Tu cuenta está suspendida o bloqueada." }, { status: 403 });
  }
  const userId = currentUser.id;

  // Rate-limit de sesión: 5 jugadas por segundo (Ajustado v1.082 para Auto-Bet rápido)
  const { allowed: rateLimitAllowed } = rateLimit(`hilo:${userId}`, 5, 1000);
  if (!rateLimitAllowed) {
    return NextResponse.json(
      { error: "Demasiadas jugadas en muy poco tiempo. Espera un momento." },
      { status: 429 }
    );
  }

  // Rate-limit persistente (anti-bot cross-worker): máx 120 jugadas por minuto
  const { allowed: persistAllowed } = await persistentRateLimit(`hilo:${userId}`, 120, 60_000);
  if (!persistAllowed) {
    await logSecurityEvent({
      eventType: "hilo_rate_limit_persistent",
      userId,
      details: { note: "Excedió 120 jugadas/min — posible bot" },
      severity: "high",
    }).catch(console.error);
    return NextResponse.json(
      { error: "Has alcanzado el límite de jugadas por minuto. Espera un momento." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));

  // === VALIDACIÓN DE PAUSA (SEGURIDAD) ===
  const isPaused = await getSetting<number>("PAUSE_GAME_HI_LO", 0);
  if (isPaused === 1) {
    return NextResponse.json({ error: "El juego HI-LO está pausado temporalmente por administración." }, { status: 403 });
  }

  const bet = Math.floor(Number(body.bet));
  const choice = body.choice === "hi" || body.choice === "lo" ? body.choice : null;
  // El client_seed ya NO se toma de la request: viene de la semilla comprometida (provably fair).

  let odds = Number(body.odds);
  if (!Number.isFinite(odds) || odds < 1.01 || odds > 4900) odds = 2;

  // Cuota efectiva (snap a la rejilla k) y apuesta mínima para que el profit sea ≥ 1.
  const k = hiLoWinningOutcomes(odds);
  const effectiveOdds = hiLoEffectiveOdds(k);
  const minBet = hiLoMinBet(effectiveOdds);

  if (!choice || bet < 1 || isNaN(bet)) {
    return NextResponse.json(
      { error: "Apuesta inválida (mínimo 1 punto) y elección hi o lo." },
      { status: 400 }
    );
  }

  if (bet < minBet) {
    return NextResponse.json(
      { error: `A la cuota ${effectiveOdds.toFixed(2)}x la apuesta mínima es ${minBet.toLocaleString()} puntos (para que la ganancia sea ≥ 1).` },
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

  const potentialWin = Math.floor(bet * effectiveOdds) - bet;
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

  // 2. Semilla comprometida (verificación INSTANTÁNEA). Usa la semilla activa (su hash
  // ya estaba comprometido) y la rota a una nueva en la misma operación. La usada se
  // revela en la respuesta y se guarda en el movimiento -> cada tirada es verificable al
  // momento; la siguiente usa otra semilla, así revelar la usada no compromete nada.
  // Antes del descuento: si el saldo fallara, a lo sumo se rota una semilla (inocuo).
  const admin = createAdminClient();
  const nextSeed = generateServerSeed();
  const fallbackSeed = generateServerSeed();
  const { data: seedData, error: seedError } = await admin.rpc("consume_hilo_seed", {
    p_user_id: userId,
    p_next_server_seed: nextSeed.serverSeed,
    p_next_server_seed_hash: nextSeed.serverSeedHash,
    p_fallback_server_seed: fallbackSeed.serverSeed,
    p_fallback_server_seed_hash: fallbackSeed.serverSeedHash,
    p_fallback_client_seed: generateClientSeed(),
  });
  if (seedError || !seedData?.[0]) {
    return NextResponse.json({ error: seedError?.message || "No se pudo obtener la semilla de juego." }, { status: 500 });
  }
  const seed = seedData[0];

  // 3. Descuento atómico de la apuesta e incremento de contador de nivel
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
  const betSeq = (count ?? 0) + 1; // solo para la cadencia del rollup

  // 4. Calcular el roll con la semilla USADA (revelada) y liquidar (función pura)
  const roll = rollFromSeeds(seed.used_server_seed, seed.client_seed, seed.nonce);
  const result = settleHiLo(bet, choice, odds, roll);
  let finalPoints = balanceAfterBet;
  // Verificación pública: la semilla usada SE REVELA (la siguiente tirada usa otra).
  const verification = {
    server_seed: seed.used_server_seed,
    server_seed_hash: seed.used_server_seed_hash,
    client_seed: seed.client_seed,
    nonce: seed.nonce,
  };

  // 5. Registrar la apuesta (Operación paralela con el premio)
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
        odds: result.effectiveOdds,
        odds_requested: result.odds,
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
        console.warn(`[Security] Premio Hi-Lo declinado para ${userId}: ${addData?.[0]?.message || addError?.message || "Límite excedido"}`);
        // Log event logicamente si es un intento de bypass
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
  if (betSeq % 50 === 0) {
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
            const wagerMult = await getSetting<number>("WAGERING_MULTIPLIER", 20);
            await supabase.rpc("credit_bonus_points", { p_user_id: ref.referrer_id, p_amount: commission, p_wager_mult: wagerMult });
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
    odds: result.effectiveOdds,
    newBalance: finalPoints,
    // Semilla USADA revelada -> el jugador verifica esta tirada al instante.
    verification: {
      server_seed: verification.server_seed,
      server_seed_hash: verification.server_seed_hash,
      client_seed: verification.client_seed,
      nonce: verification.nonce,
    },
    // Hash de la próxima semilla comprometida (para el panel: se ve ANTES de la siguiente tirada).
    next_server_seed_hash: seed.next_server_seed_hash,
  });
}
