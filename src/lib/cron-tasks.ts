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
import { sendDailySummary, sendTelegramMessage } from "@/lib/telegram";
import { sendBolisToWallet } from "@/lib/solana";
import { POINTS_PER_BOLIS } from "@/lib/config";

// --- DEPOSITS ---

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SIGS_PER_ADDRESS = 20;

export async function processDeposits() {
  if (SHOULD_SKIP_CRON) return { ok: true, skipped: true };
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: usersData, error: usersError } = await supabase
    .from("profiles")
    .select("id, deposit_address, email")
    .not("deposit_address", "is", null);

  if (usersError) return { ok: false, error: usersError.message };

  const users = usersData ?? [];
  const conn = new Connection(RPC);
  const mint = new PublicKey(BOLIS_MINT);
  const processed: string[] = [];
  const errors: string[] = [];

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

          const { data: balanceRow } = await supabase
            .from("balances")
            .select("points")
            .eq("user_id", user.id)
            .single();
          const newPoints = Number(balanceRow?.points ?? 0) + pointsToAdd;

          await supabase.from("balances").upsert(
            { user_id: user.id, points: newPoints, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
          await supabase.from("movements").insert({
            user_id: user.id,
            type: "deposito_bolis",
            points: pointsToAdd,
            reference: signature,
            metadata: { bolisAmount: result.amount },
          });

          try {
            const { data: wallet } = await supabase
              .from("deposit_wallets")
              .select("encrypted_private_key")
              .eq("user_id", user.id)
              .single();
            if (wallet?.encrypted_private_key && getTreasuryKeypair()) {
              const kp = getDepositKeypair(wallet.encrypted_private_key);
              await sweepBolisToTreasury(kp, result.amount);
            }
          } catch {}

          await supabase.from("processed_deposits").insert({
            tx_signature: signature,
            user_id: user.id,
            amount_bolis: result.amount,
            points_added: pointsToAdd,
          });

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

  return { ok: true, processed: processed.length, errors: errors.length ? errors : undefined };
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
      const { data: bal } = await supabase.from("balances").select("points").eq("user_id", userId).single();
      const currentPts = Number(bal?.points ?? 0);
      await supabase.from("balances").upsert({ user_id: userId, points: currentPts + points }, { onConflict: "user_id" });
      await supabase.from("movements").insert({ user_id: userId, type: "premio_ranking", points, reference: `${cfg.period}:${cfg.periodKey}:rank${prize.rank}` });
      results.push(`${cfg.period}/${cfg.periodKey} #${prize.rank}: ${points} pts -> ${userId.slice(0, 8)}`);
    }
  }
  return { ok: true, results };
}

// --- DAILY SUMMARY ---

export async function runDailySummary() {
  if (SHOULD_SKIP_CRON) return { ok: true, message: "Skipped in build" };
  console.log("CRON: Iniciando runDailySummary...");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  try {
    console.log("CRON: Consultando estadísticas del periodo:", yesterday.toISOString(), "al", todayStart.toISOString());
    const [newUsersRes, activeUsersRes, betsRes, faucetRes, withdrawalsRes, depositsRes, revenueRes, costRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", yesterday.toISOString()).lt("created_at", todayStart.toISOString()),
      supabase.from("movements").select("user_id").gte("created_at", yesterday.toISOString()).lt("created_at", todayStart.toISOString()),
      supabase.from("movements").select("id", { count: "exact", head: true }).in("type", ["apuesta_hi_lo", "apuesta_prediccion"]).gte("created_at", yesterday.toISOString()).lt("created_at", todayStart.toISOString()),
      supabase.from("movements").select("id", { count: "exact", head: true }).eq("type", "faucet").gte("created_at", yesterday.toISOString()).lt("created_at", todayStart.toISOString()),
      supabase.from("movements").select("id", { count: "exact", head: true }).eq("type", "retiro_bolis").gte("created_at", yesterday.toISOString()).lt("created_at", todayStart.toISOString()),
      supabase.from("movements").select("id", { count: "exact", head: true }).eq("type", "deposito_bolis").gte("created_at", yesterday.toISOString()).lt("created_at", todayStart.toISOString()),
      supabase.from("movements").select("points").in("type", ["apuesta_hi_lo", "apuesta_prediccion"]).gte("created_at", yesterday.toISOString()).lt("created_at", todayStart.toISOString()),
      supabase.from("movements").select("points, type").in("type", ["faucet", "premio_hi_lo", "premio_prediccion", "comision_afiliado", "logro", "recompensa", "bonus_referido_verificado", "premio_ranking"]).gte("created_at", yesterday.toISOString()).lt("created_at", todayStart.toISOString()),
    ]);

    const errors = [newUsersRes, activeUsersRes, betsRes, faucetRes, withdrawalsRes, depositsRes, revenueRes, costRes].filter(r => r.error);
    if (errors.length > 0) {
      console.error("CRON ERROR: Fallo en consultas Supabase", errors[0].error);
      return { ok: false, error: "Error en consultas de base de datos" };
    }

    const uniqueActiveUsers = new Set((activeUsersRes.data ?? []).map((m: any) => m.user_id)).size;
    const revenue = (revenueRes.data ?? []).reduce((s, m) => s + Math.abs(Number(m.points) || 0), 0);
    const costs = (costRes.data ?? []).reduce((s, m) => s + (Number(m.points) || 0), 0);
    const platformBalance = revenue - costs;

    console.log("CRON: Enviando resumen a Telegram...");
    const sent = await sendDailySummary({ 
        newUsers: newUsersRes.count ?? 0, 
        activeUsers: uniqueActiveUsers, 
        totalBets: betsRes.count ?? 0, 
        totalFaucetClaims: faucetRes.count ?? 0, 
        withdrawalRequests: withdrawalsRes.count ?? 0, 
        depositCount: depositsRes.count ?? 0, 
        platformBalance 
    });

    return { ok: sent, message: sent ? "Resumen enviado" : "Fallo al enviar a Telegram" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("CRON EXCEPTION:", err);
    await sendTelegramMessage(`❌ Error en resumen diario: ${msg}`, "critical");
    return { ok: false, error: msg };
  }
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
