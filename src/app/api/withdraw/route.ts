import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { alertWithdrawalRequest, alertSuspiciousActivity } from "@/lib/telegram";
import { getSetting } from "@/lib/site-settings";
import { fetchUserLevel } from "@/lib/levels";
import { PublicKey } from "@solana/web3.js";
import { persistentRateLimit, logSecurityEvent, flagWithdrawalAnomaly } from "@/lib/security";
import { getRequestIpHash } from "@/lib/ip";
import { isGlobalCapReached } from "@/lib/wagering";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ code: "unauthorized", error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(currentUser.status)) {
    return NextResponse.json({ code: "account_blocked", error: "Tu cuenta está suspendida o bloqueada." }, { status: 403 });
  }
  const userId = currentUser.id;

  const withdrawRateMax = await getSetting<number>("WITHDRAW_RATE_MAX", 5);
  const withdrawWindowHours = await getSetting<number>("WITHDRAW_RATE_WINDOW_HOURS", 1);
  const windowMs = withdrawWindowHours * 60 * 60 * 1000;

  // Capa 1: Rate-limit en memoria (rápida, primera barrera)
  const { allowed: inMemAllowed, retryAfterSeconds: inMemRetry } = rateLimit(`withdraw:${userId}`, withdrawRateMax, windowMs);
  if (!inMemAllowed) {
    return NextResponse.json({ code: "rate_limit", params: [Math.ceil(inMemRetry / 60)], error: `Demasiadas solicitudes de retiro. Espera ${Math.ceil(inMemRetry / 60)} minuto(s).` }, { status: 429 });
  }

  // Capa 2: Rate-limit persistente en Supabase (global entre todos los workers de Vercel)
  const { allowed: persAllowed, retryAfterSeconds: persRetry } = await persistentRateLimit(
    `withdraw:${userId}`, withdrawRateMax, windowMs
  );
  if (!persAllowed) {
    const ipHash = await getRequestIpHash();
    await logSecurityEvent({
      eventType: "rate_limit_exceeded",
      userId,
      ipHash,
      details: { endpoint: "withdraw", retryAfterSeconds: persRetry },
      severity: "medium",
    });
    return NextResponse.json({ code: "rate_limit", params: [Math.ceil(persRetry / 60)], error: `Demasiadas solicitudes de retiro. Espera ${Math.ceil(persRetry / 60)} minuto(s).` }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const points = Number(body.points);
  const bolisAmount = points / POINTS_PER_BOLIS;
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";

  const supabase = await createClient();

  // Edad de la cuenta: las cuentas muy nuevas no se auto-pagan on-chain; van a
  // revisión manual. Defiende el patrón de granja (alta -> farmeo -> auto-retiro).
  const autoWithdrawMinDays = await getSetting<number>("AUTO_WITHDRAW_MIN_ACCOUNT_DAYS", 3);
  const { data: acct } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .single();
  const accountAgeDays = acct?.created_at
    ? Math.floor((Date.now() - new Date(acct.created_at).getTime()) / 86400000)
    : 0;
  const accountTooNew = accountAgeDays < autoWithdrawMinDays;

  // 0. Verificación de habilitación GLOBAL de retiros
  const withdrawalsEnabled = await getSetting<number>("WITHDRAWALS_ENABLED", 1);
  if (withdrawalsEnabled === 0) {
    return NextResponse.json({ code: "withdrawals_disabled", error: "Los retiros se encuentran temporalmente deshabilitados por mantenimiento o seguridad. Inténtalo más tarde." }, { status: 503 });
  }

  const userLevel = await fetchUserLevel(supabase, userId);
  const maxWithdrawBolis = userLevel.benefits.maxWithdrawBolis;
  const requestedBolis = points / POINTS_PER_BOLIS;

  // 1. Validar Puntos y Billetera (Formato Básico y Red Solana)
  if (!Number.isInteger(points) || points < MIN_WITHDRAW_POINTS || !wallet || wallet.length < 32) {
    return NextResponse.json({ code: "invalid_data", params: [MIN_WITHDRAW_POINTS.toLocaleString()], error: `Datos inválidos. Mínimo ${MIN_WITHDRAW_POINTS.toLocaleString()} puntos.` }, { status: 400 });
  }

  if (requestedBolis > maxWithdrawBolis) {
    // Si maxWithdrawBolis es 0, el nivel no tiene derecho a retiro
    if (maxWithdrawBolis === 0) {
      return NextResponse.json({ code: "level_no_withdraw", error: `El nivel ${userLevel.icon} ${userLevel.name} no tiene derecho a retiro. Sube al nivel Jugador para desbloquear los retiros (mínimo 10,000 puntos).` }, { status: 403 });
    }
    return NextResponse.json({ code: "level_max", params: [userLevel.name, maxWithdrawBolis, (maxWithdrawBolis * POINTS_PER_BOLIS).toLocaleString()], error: `Tu nivel (${userLevel.name}) permite un retiro máximo de ${maxWithdrawBolis} BOLIS (${(maxWithdrawBolis * POINTS_PER_BOLIS).toLocaleString()} puntos) por solicitud.` }, { status: 400 });
  }

  try {
    // Verificación estricta de la dirección de Solana
    new PublicKey(wallet);
  } catch (e) {
    return NextResponse.json({ code: "invalid_wallet", error: "La dirección introducida no es una billetera válida de la red Solana. Por favor, revísala." }, { status: 400 });
  }

  // ... (supabase ya está creado arriba)

  // 0. Revisión Anti-Sybil: Verificar si esta wallet ha sido usada por OTRO usuario.
  const { data: previousUsage, error: usageError } = await supabase
    .from("withdrawals")
    .select("user_id")
    .eq("wallet_destination", wallet)
    .limit(1);

  if (!usageError && previousUsage && previousUsage.length > 0) {
    if (previousUsage[0].user_id !== userId) {
      return NextResponse.json({ code: "wallet_reused", error: "Esta billetera protegida ya fue utilizada por otro usuario. Por reglas Anti-Fraude, debes usar una billetera de Solana única y personal." }, { status: 403 });
    }
  }

  // ── Detección de anomalías: más de 3 retiros exitosos en las últimas 24h ──
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const { count: recentWithdrawals } = await supabase
    .from("withdrawals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneDayAgo);

  const hasOverride = currentUser.withdrawLimitOverrideUntil && new Date(currentUser.withdrawLimitOverrideUntil) > new Date();

  if (!hasOverride && (recentWithdrawals ?? 0) >= 3) {
    await logSecurityEvent({
      eventType: "suspicious_withdrawal_frequency",
      userId,
      details: { recentCount: recentWithdrawals, points, wallet },
      severity: "high",
    });
    
    // Alerta vía Telegram
    await alertSuspiciousActivity(
      currentUser.email, 
      `Frecuencia de retiro alta detectada (${recentWithdrawals} en 24h). Retiro de ${points.toLocaleString()} pts BLOQUEADO automáticamente.`
    );

    return NextResponse.json({ code: "frequency_blocked", error: "Tu solicitud de retiro ha sido bloqueada temporalmente por seguridad debido a la alta frecuencia de retiros en las últimas 24 horas. Por favor, contacta con soporte." }, { status: 403 });
  }

  if (hasOverride) {
    console.log(`[Withdraw] Usuario ${userId} tiene un bypass activo (hasta ${currentUser.withdrawLimitOverrideUntil}). Ignorando límite de frecuencia.`);
  }

  // 1. Ejecutar solicitud de retiro de forma atómica (Evita Race Condition)
  const { data: withdrawData, error: withdrawError } = await supabase.rpc("create_withdrawal_request", {
    target_user_id: userId,
    amount_points: points,
    dest_wallet: wallet
  });

  if (withdrawError || !withdrawData?.[0]?.success) {
    return NextResponse.json({
        code: withdrawData?.[0]?.error_message || "withdraw_failed",
        error: withdrawError?.message || "No se pudo procesar el retiro."
    }, { status: 400 });
  }

  const withdrawalId = withdrawData[0].withdrawal_id;
  const newBalance = Number(withdrawData[0].result_balance);

  // Retiro de cuenta nueva: marcar para revisión manual (no se auto-pagará).
  if (accountTooNew) {
    await flagWithdrawalAnomaly({
      withdrawalId,
      userId,
      wallet,
      points,
      reason: `Cuenta nueva (${accountAgeDays}d < ${autoWithdrawMinDays}d): retiro retenido para revisión manual.`,
    }).catch(() => {});
    await logSecurityEvent({
      eventType: "withdrawal_new_account_hold",
      userId,
      details: { accountAgeDays, points, wallet },
      severity: "high",
    }).catch(() => {});
  }

  // 2. Registrar el movimiento para el historial
  await supabase.from("movements").insert({
    user_id: userId,
    type: "retiro_bolis",
    points: -points,
    reference: withdrawalId,
    metadata: { wallet_destination: wallet, status: "pending" },
  });

  const autoWithdrawGlobal = await getSetting<number>("WITHDRAWAL_AUTO_APPROVE_ENABLED", 1);
  const autoWithdrawUserLevel = await getSetting<boolean>("WITHDRAWAL_AUTO_APPROVE", false);

  // M2: presupuesto GLOBAL de pagos on-chain por día. Al superarlo, el retiro
  // queda en 'pending' (no auto-pago) en vez de drenar la reserva sin control.
  const dailyCapBolis = await getSetting<number>("WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS", 500);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { data: paidTodayRows } = await supabase
    .from("withdrawals")
    .select("points")
    .eq("status", "completed")
    .gte("processed_at", dayStart.toISOString());
  const paidBolisToday = (paidTodayRows ?? []).reduce((s, w) => s + Number(w.points), 0) / POINTS_PER_BOLIS;
  const globalCapReached = isGlobalCapReached({ paidBolisToday, thisBolis: bolisAmount, capBolis: dailyCapBolis });

  if (globalCapReached) {
    await logSecurityEvent({
      eventType: "withdrawal_global_cap_reached",
      userId,
      details: { paidBolisToday, thisBolis: bolisAmount, capBolis: dailyCapBolis },
      severity: "medium",
    }).catch(() => {});
  }

  // Límite de 100,000 puntos para retiros automáticos según requerimiento
  // Además debe estar habilitado el auto-pago globalmente y para el nivel del usuario
  const isAutoEligible = autoWithdrawGlobal === 1 && autoWithdrawUserLevel && points <= 100000 && !accountTooNew && !globalCapReached;
  let txHash = null;

  let autoError = null;

  if (isAutoEligible) {
      try {
          console.log(`[AutoWithdraw] Iniciando procesamiento automático para ${points} pts / ${bolisAmount} BOLIS (ID: ${withdrawalId})`);
          const { getOnChainBalances } = await import("@/lib/solana-payments");
          
          // Verificar saldo de la Master Wallet antes de intentar el envío
          const masterSecretKey = process.env.BOT_MASTER_SECRET_KEY || process.env.SOLANA_WALLET_PRIVATE_KEY_BASE58;
          if (masterSecretKey) {
              const { Keypair } = await import("@solana/web3.js");
              const bs58 = (await import("bs58")).default;
              const masterKp = Keypair.fromSecretKey(bs58.decode(masterSecretKey));
              // Verificar saldo de la Master Wallet antes de intentar el envío
              const masterBalances = await getOnChainBalances(masterKp.publicKey.toBase58());

              if (masterBalances.bolis >= bolisAmount) {
                  if (masterBalances.sol < 0.001) {
                      throw new Error(`Master Wallet insuficiente de SOL para gas (${masterBalances.sol} SOL)`);
                  }

                  const { sendBolisToWallet } = await import("@/lib/solana");
                  txHash = await sendBolisToWallet(wallet, bolisAmount);
                  
                  if (txHash) {
                      console.log(`[AutoWithdraw] Éxito. TX: ${txHash}`);
                      // 1. Actualizar estado a completado en la tabla de retiros
                      const { error: updError } = await supabase.from("withdrawals")
                        .update({ 
                            status: "completed", 
                            processed_at: new Date().toISOString(), 
                            tx_signature: txHash 
                        })
                        .eq("id", withdrawalId);
                      
                      if (updError) console.error("[AutoWithdraw] Error actualizando withdrawals:", updError.message);

                      // 2. Actualizar el metadato del movimiento para reflejar el estado completado
                      const { error: movError } = await supabase.from("movements")
                        .update({ 
                            metadata: { 
                                wallet_destination: wallet, 
                                status: "completed", 
                                tx_signature: txHash,
                                auto_processed: true
                            } 
                        })
                        .eq("reference", withdrawalId)
                        .eq("type", "retiro_bolis");
                      
                      if (movError) console.error("[AutoWithdraw] Error actualizando movements:", movError.message);
                  }
              } else {
                  const errMsg = `Saldo insuficiente en Master Wallet (${masterBalances.bolis} BOLIS < ${bolisAmount} requeridos). Queda como 'pending'.`;
                  console.warn(`[AutoWithdraw] ${errMsg}`);
                  autoError = errMsg;
              }
          } else {
              const errMsg = "Configuración faltante: BOT_MASTER_SECRET_KEY no configurado.";
              console.error(`[AutoWithdraw] ${errMsg}`);
              autoError = errMsg;
          }
      } catch (err: any) {
          autoError = `Error en ejecución de Solana: ${err.message}`;
          console.error("[AutoWithdraw] Error crítico:", err.message);
      }
  } else if (autoWithdrawGlobal === 1 && autoWithdrawUserLevel && points > 100000) {
      console.log(`[AutoWithdraw] Retiro superior a 100,000 pts (${points}). Requiere aprobación manual.`);
  }

  console.log(`[Withdraw] Finalizado. ID: ${withdrawalId}, Eligible: ${isAutoEligible}, Tx: ${txHash}, Error: ${autoError}`);

  try {
      await alertWithdrawalRequest(currentUser.email, points, wallet);
  } catch (e) {
      console.error("Error al enviar alerta Telegram:", e);
  }

  return NextResponse.json({
    ok: true,
    withdrawalId: withdrawalId,
    balance: newBalance,
    autoProcessed: !!txHash,
    bolisAmount: bolisAmount,
    pendingReason: !txHash ? (globalCapReached ? "global_cap" : (accountTooNew ? "new_account" : "manual")) : null,
  });
}
