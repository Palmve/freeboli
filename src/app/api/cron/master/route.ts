import { NextResponse } from "next/server";
import { awardPrizes, runDailySummary, processDeposits, notifyPendingWithdrawals } from "@/lib/cron-tasks";
import { resolvePendingRounds, ensureActiveRound } from "@/lib/predictions";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * MASTER CRON - UNIFICADO (v1.038)
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  
  const report: any = {
    timestamp: now.toISOString(),
    tasks: []
  };

  try {
    // 1. Depósitos (Barrido)
    const depRes = await processDeposits();
    report.tasks.push({ name: "process_deposits", result: depRes });

    // 1.b Retiros Pendientes (Notificación)
    const witRes = await notifyPendingWithdrawals();
    report.tasks.push({ name: "pending_withdrawals", result: witRes });

    // 2. Resolver Rondas (Backup horario)
    if (minute < 15) {
        const resolved = await resolvePendingRounds();
        await ensureActiveRound("BTC");
        await ensureActiveRound("SOL");
        await ensureActiveRound("BOLIS");
        report.tasks.push({ name: "predictions", resolved });
    }

    // 3. Premios (Hora 0)
    if (hour === 0 && minute < 15) {
        const prizeRes = await awardPrizes();
        report.tasks.push({ name: "award_prizes", result: prizeRes });
    }

    // 4. Resumen (Hora 1)
    if (hour === 1 && minute < 15) {
        const summaryRes = await runDailySummary();
        report.tasks.push({ name: "daily_summary", result: summaryRes });
    }

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`🚨 MASTER CRON FAIL: ${msg}`, "critical");
    return NextResponse.json({ error: msg, report }, { status: 500 });
  }
}
