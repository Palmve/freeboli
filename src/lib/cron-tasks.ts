import { createClient } from "@supabase/supabase-js";

// No usar "production && !VERCEL": eso desactiva cron en cualquier host propio (Docker, VPS, etc.).
// Solo omitir en CI de Vercel antes de runtime, o si se fuerza SKIP_CRON=true.
const IS_VERCEL_CI_WITHOUT_RUNTIME = process.env.CI === "true" && !process.env.VERCEL_ENV;
const SHOULD_SKIP_CRON =
  process.env.SKIP_CRON === "true" || IS_VERCEL_CI_WITHOUT_RUNTIME;

if (SHOULD_SKIP_CRON) {
    if (typeof process !== 'undefined') {
        // console.log("CRON: Fase de build detectada, desactivando tareas automáticas.");
    }
}
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  verifyIncomingBolisTransfer,
  bolisToPoints,
  sweepBolisToTreasury,
  getTreasuryKeypair,
} from "@/lib/solana";
import { getDepositKeypair } from "@/lib/deposit-wallet";
import { BOLIS_MINT } from "@/lib/config";
import { alertDepositDetected, alertWithdrawalRequest, alertWithdrawalCompleted } from "@/lib/telegram";
import { getSetting } from "@/lib/site-settings";
import { sendDailySummary, sendTelegramMessage, sendActivityPulse, sendNoActivityAlert } from "@/lib/telegram";
import { sendBolisToWallet } from "@/lib/solana";
import { POINTS_PER_BOLIS } from "@/lib/config";

// --- DEPOSITS ---

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SIGS_PER_ADDRESS = 20;

export type ProcessDepositsOptions = { 
  trackPromoCreditForUserId?: string | null;
  targetUserId?: string | null;
};

export type ProcessDepositsResult = {
  ok: boolean;
  skipped?: boolean;
  processed?: number;
  errors?: string[];
  error?: string;
  /** Si se pidió seguimiento y este usuario recibió crédito al pozo en esta corrida */
  promoCredit?: { promoId: string; pointsAdded: number } | null;
};

export async function processDeposits(options?: ProcessDepositsOptions): Promise<ProcessDepositsResult> {
  if (SHOULD_SKIP_CRON) return { ok: true, skipped: true };
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabase
    .from("profiles")
    .select("id, deposit_address, email")
    .not("deposit_address", "is", null);
  
  if (options?.targetUserId) {
    query = query.eq("id", options.targetUserId);
  }

  const { data: usersData, error: usersError } = await query;

  if (usersError) return { ok: false, error: usersError.message };

  const users = usersData ?? [];
  const conn = new Connection(RPC);
  const mint = new PublicKey(BOLIS_MINT);
  const processed: string[] = [];
  const errors: string[] = [];
  let promoCreditForTracker: { promoId: string; pointsAdded: number } | null = null;

  for (const user of users) {
    const depositAddress = user.deposit_address as string;
    try {
      const ata = await getAssociatedTokenAddress(mint, new PublicKey(depositAddress));
      let sigs: any[] = [];
      try {
        const sigsData = await conn.getSignaturesForAddress(ata, { limit: SIGS_PER_ADDRESS }, "finalized");
        sigs = sigsData ?? [];
      } catch (e) {
        errors.push(`Error sigs ${depositAddress}: ${String(e)}`);
        continue;
      }

      for (const { signature } of sigs) {
        try {
          const { data: existing } = await supabase
            .from("processed_deposits")
            .select("tx_signature")
            .eq("tx_signature", signature)
            .single();
          if (existing) continue;

          const result = await verifyIncomingBolisTransfer(signature, depositAddress);
          if (!result || result.amount <= 0) continue;

          const pointsToAdd = bolisToPoints(result.amount);
          if (pointsToAdd <= 0) continue;

          // Verificar si hay una intención de depósito para promo
          const { data: pendingPromo } = await supabase
            .from("pending_promo_deposits")
            .select("promo_id")
            .eq("user_id", user.id)
            .single();

          if (pendingPromo) {
            const { data: rpcResult, error: rpcError } = await supabase.rpc("atomic_add_promo_points", {
              target_promo_id: pendingPromo.promo_id,
              amount_to_add: pointsToAdd,
            });

            if (rpcError) {
              errors.push(`${signature}: promo RPC ${rpcError.message}`);
              continue;
            }
            const rpcOk =
              rpcResult &&
              typeof rpcResult === "object" &&
              (rpcResult as { success?: boolean }).success === true;
            if (!rpcOk) {
              errors.push(`${signature}: promo RPC rejected ${JSON.stringify(rpcResult)}`);
              continue;
            }

            await supabase.from("movements").insert({
              user_id: user.id,
              type: "deposito_promo",
              points: pointsToAdd,
              reference: signature,
              metadata: { bolisAmount: result.amount, promo_id: pendingPromo.promo_id },
            });

            await supabase.from("pending_promo_deposits").delete().eq("user_id", user.id);

            await supabase.from("processed_deposits").insert({
              tx_signature: signature,
              user_id: user.id,
              promo_id: pendingPromo.promo_id,
              amount_bolis: result.amount,
              points_added: pointsToAdd,
            });

            const tid = options?.trackPromoCreditForUserId;
            if (tid && user.id === tid) {
              const prev = promoCreditForTracker;
              if (prev !== null && prev.promoId === pendingPromo.promo_id) {
                prev.pointsAdded += pointsToAdd;
              } else {
                promoCreditForTracker = { promoId: pendingPromo.promo_id, pointsAdded: pointsToAdd };
              }
            }
          } else {
            // Acreditar al USUARIO (Lógica original)
            await supabase.rpc("atomic_add_points", {
              target_user_id: user.id,
              amount_to_add: pointsToAdd
            });
            await supabase.from("movements").insert({
              user_id: user.id,
              type: "deposito_bolis",
              points: pointsToAdd,
              reference: signature,
              metadata: { bolisAmount: result.amount },
            });

            await supabase.from("processed_deposits").insert({
              tx_signature: signature,
              user_id: user.id,
              amount_bolis: result.amount,
              points_added: pointsToAdd,
            });
          }

          // Alerta Telegram
          try { await alertDepositDetected(user.email || user.id, pointsToAdd, signature); } catch {}
          
          processed.push(signature);
        } catch (e) {
          errors.push(`${signature}: ${String(e)}`);
        }
      }
    } catch (e) {
      errors.push(`user ${user.id}: ${String(e)}`);
    }
  }

  return {
    ok: true,
    processed: processed.length,
    errors: errors.length ? errors : undefined,
    promoCredit: promoCreditForTracker,
  };
}

// --- RANKING PRIZES ---

const RANKING_TYPES = ["faucet", "apuesta_hi_lo", "apuesta_prediccion", "logro", "recompensa", "comision_afiliado", "bonus_referido_verificado", "premio_ranking"];

interface PrizeConfig {
  period: "daily" | "weekly" | "monthly";
  periodKey: string;
  dateFrom: string;
  dateTo: string;
  prizes: { rank: number; settingKey: string; fallback: number }[];
}

function getPrizeConfigs(now: Date): PrizeConfig[] {
  const configs: PrizeConfig[] = [];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  const yStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  const yEnd = new Date(yStart);
  yEnd.setDate(yEnd.getDate() + 1);
  configs.push({
    period: "daily", periodKey: yKey, dateFrom: yStart.toISOString(), dateTo: yEnd.toISOString(),
    prizes: [
      { rank: 1, settingKey: "PRIZE_DAILY_1", fallback: 500 },
      { rank: 2, settingKey: "PRIZE_DAILY_2", fallback: 300 },
      { rank: 3, settingKey: "PRIZE_DAILY_3", fallback: 100 },
    ],
  });
  if (now.getDay() === 1) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now);
    weekEnd.setHours(0, 0, 0, 0);
    configs.push({
      period: "weekly", periodKey: `W${weekStart.toISOString().slice(0, 10)}`, dateFrom: weekStart.toISOString(), dateTo: weekEnd.toISOString(),
      prizes: [
        { rank: 1, settingKey: "PRIZE_WEEKLY_1", fallback: 5000 },
        { rank: 2, settingKey: "PRIZE_WEEKLY_2", fallback: 3000 },
        { rank: 3, settingKey: "PRIZE_WEEKLY_3", fallback: 1000 },
      ],
    });
  }
  if (now.getDate() === 1) {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    configs.push({
      period: "monthly", periodKey: `M${prevMonth.toISOString().slice(0, 7)}`, dateFrom: prevMonth.toISOString(), dateTo: monthEnd.toISOString(),
      prizes: [
        { rank: 1, settingKey: "PRIZE_MONTHLY_1", fallback: 25000 },
        { rank: 2, settingKey: "PRIZE_MONTHLY_2", fallback: 15000 },
        { rank: 3, settingKey: "PRIZE_MONTHLY_3", fallback: 5000 },
      ],
    });
  }
  return configs;
}

export async function awardPrizes() {
  if (SHOULD_SKIP_CRON) return { ok: true };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const now = new Date();
  const configs = getPrizeConfigs(now);
  const results: string[] = [];

  for (const cfg of configs) {
    const { count: existing } = await supabase.from("prize_awards").select("id", { count: "exact", head: true }).eq("period", cfg.period).eq("period_key", cfg.periodKey);
    if ((existing ?? 0) > 0) { results.push(`${cfg.period}/${cfg.periodKey}: ya otorgado`); continue; }

    const { data: movements } = await supabase.from("movements").select("user_id, points").in("type", RANKING_TYPES).gte("created_at", cfg.dateFrom).lt("created_at", cfg.dateTo).limit(50000);
    const earningsByUser: Record<string, number> = {};
    (movements ?? []).forEach((m) => {
      const pts = Math.abs(Number(m.points) || 0);
      earningsByUser[m.user_id] = (earningsByUser[m.user_id] ?? 0) + pts;
    });
    const sorted = Object.entries(earningsByUser).sort((a, b) => b[1] - a[1]);

    for (const prize of cfg.prizes) {
      if (sorted.length < prize.rank) continue;
      const [userId] = sorted[prize.rank - 1];
      const points = await getSetting<number>(prize.settingKey, prize.fallback);
      await supabase.from("prize_awards").insert({ user_id: userId, period: cfg.period, period_key: cfg.periodKey, rank: prize.rank, points });
      await supabase.rpc("atomic_add_points", {
        target_user_id: userId,
        amount_to_add: points
      });
      await supabase.from("movements").insert({ user_id: userId, type: "premio_ranking", points, reference: `${cfg.period}:${cfg.periodKey}:rank${prize.rank}` });
      results.push(`${cfg.period}/${cfg.periodKey} #${prize.rank}: ${points} pts -> ${userId.slice(0, 8)}`);
    }
  }
  return { ok: true, results };
}

// --- DAILY SUMMARY ---

export async function runDailySummary() {
  if (SHOULD_SKIP_CRON) return { ok: true, message: "Skipped in build" };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const from = yesterday.toISOString();
  const to = todayStart.toISOString();
  const dayKey = yesterday.toISOString().slice(0, 10);

  // Idempotencia: no reenviar el resumen del mismo día (el tick horario puede
  // golpear más de una vez la hora objetivo).
  const { data: lastRow } = await supabase.from("site_settings").select("value").eq("key", "LAST_DAILY_SUMMARY_DATE").maybeSingle();
  const lastVal = lastRow?.value != null ? String(lastRow.value).replace(/"/g, "") : null;
  if (lastVal === dayKey) return { ok: true, message: "Resumen del día ya enviado" };

  try {
    const mov = (type: string) => supabase.from("movements").select("points").eq("type", type).gte("created_at", from).lt("created_at", to);
    const [
      newUsersRes, activeUsersRes,
      hiloBetRes, hiloWinRes, predBetRes, predWinRes, faucetRes,
      withdrawalsRes, depositsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", from).lt("created_at", to),
      supabase.from("movements").select("user_id").gte("created_at", from).lt("created_at", to),
      mov("apuesta_hi_lo"), mov("premio_hi_lo"),
      mov("apuesta_prediccion"), mov("premio_prediccion"),
      mov("faucet"),
      supabase.from("movements").select("id", { count: "exact", head: true }).eq("type", "retiro_bolis").gte("created_at", from).lt("created_at", to),
      supabase.from("movements").select("id", { count: "exact", head: true }).eq("type", "deposito_bolis").gte("created_at", from).lt("created_at", to),
    ]);

    // Conexiones (analytics_events) — defensivo: la tabla podría no existir.
    let connections = 0, connectedUsers = 0;
    try {
      const { data: ev } = await supabase.from("analytics_events").select("user_id").gte("created_at", from).lt("created_at", to);
      connections = (ev ?? []).length;
      connectedUsers = new Set((ev ?? []).map((e: any) => e.user_id).filter(Boolean)).size;
    } catch { /* tabla ausente */ }

    const sumAbs = (r: any) => (r?.data ?? []).reduce((s: number, m: any) => s + Math.abs(Number(m.points) || 0), 0);
    const cnt = (r: any) => (r?.data ?? []).length;

    const stats = {
      connections, connectedUsers,
      activeUsers: new Set((activeUsersRes.data ?? []).map((m: any) => m.user_id)).size,
      newUsers: newUsersRes.count ?? 0,
      hiLoBets: cnt(hiloBetRes), hiLoBetPoints: sumAbs(hiloBetRes), hiLoPayoutPoints: sumAbs(hiloWinRes),
      predBets: cnt(predBetRes), predBetPoints: sumAbs(predBetRes), predPayoutPoints: sumAbs(predWinRes),
      faucetClaims: cnt(faucetRes), faucetPoints: sumAbs(faucetRes),
      withdrawalRequests: withdrawalsRes.count ?? 0,
      depositCount: depositsRes.count ?? 0,
    };

    // Dead-man's-switch: 24h sin NINGUNA actividad → posible caída de la app.
    const noActivity = connections === 0 && stats.activeUsers === 0 && stats.hiLoBets === 0 && stats.predBets === 0 && stats.faucetClaims === 0;
    const sent = noActivity ? await sendNoActivityAlert() : await sendDailySummary(stats);

    // Marcar el día como enviado (idempotencia).
    await supabase.from("site_settings").upsert({ key: "LAST_DAILY_SUMMARY_DATE", value: JSON.stringify(dayKey) }, { onConflict: "key" });

    return { ok: sent, noActivity, stats };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("CRON EXCEPTION:", err);
    await sendTelegramMessage(`❌ Error en resumen diario: ${msg}`, "critical");
    return { ok: false, error: msg };
  }
}

/** Pulso ligero cada X horas (lo dispara el tick horario de GitHub Actions). */
export async function runActivityPulse(windowHours = 6) {
  if (SHOULD_SKIP_CRON) return { ok: true, skipped: true };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const from = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();

  let connections = 0, connectedUsers = 0;
  try {
    const { data: ev } = await supabase.from("analytics_events").select("user_id").gte("created_at", from);
    connections = (ev ?? []).length;
    connectedUsers = new Set((ev ?? []).map((e: any) => e.user_id).filter(Boolean)).size;
  } catch { /* tabla ausente */ }

  const [{ data: bets }, { data: fauc }] = await Promise.all([
    supabase.from("movements").select("id").in("type", ["apuesta_hi_lo", "apuesta_prediccion"]).gte("created_at", from),
    supabase.from("movements").select("id").eq("type", "faucet").gte("created_at", from),
  ]);

  const sent = await sendActivityPulse({
    windowHours,
    connections,
    connectedUsers,
    bets: (bets ?? []).length,
    faucetClaims: (fauc ?? []).length,
  });
  return { ok: sent };
}

// --- WITHDRAWALS ---

export async function notifyPendingWithdrawals() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data, count, error } = await supabase
    .from("withdrawals")
    .select("id, points, wallet_destination, profiles(email)", { count: "exact" })
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };

  if (count && count > 0) {
    const text = `⚠️ <b>Hay ${count} retiros pendientes</b> de procesar.
Por favor, entra al panel admin para enviarlos.`;
    await sendTelegramMessage(text, "warning");
    return { ok: true, notified: count };
  }

  return { ok: true, notified: 0 };
}

export async function processWithdrawals() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data: pendings, error } = await supabase
    .from("withdrawals")
    .select("id, user_id, points, wallet_destination, status")
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };

  const processed: string[] = [];
  const errors: string[] = [];

  for (const w of (pendings ?? [])) {
    try {
      const amountBolis = Number(w.points) / POINTS_PER_BOLIS;
      const sig = await sendBolisToWallet(w.wallet_destination, amountBolis);
      
      if (!sig) {
        errors.push(`Withdrawal ${w.id}: Failed to send BOLIS`);
        continue;
      }

      await supabase
        .from("withdrawals")
        .update({
          status: "completed",
          tx_signature: sig,
          processed_at: new Date().toISOString(),
        })
        .eq("id", w.id);

      const { data: u } = await supabase.from("profiles").select("email").eq("id", w.user_id).single();
      await alertWithdrawalCompleted(u?.email ?? String(w.user_id), Number(w.points), sig);
      
      processed.push(w.id);
    } catch (e) {
      errors.push(`Withdrawal ${w.id}: ${String(e)}`);
    }
  }

  return { ok: true, processed: processed.length, errors: errors.length ? errors : undefined };
}
