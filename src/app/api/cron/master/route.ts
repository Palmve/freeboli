import { NextResponse } from "next/server";
import { awardPrizes } from "../award-prizes/route";
import { runDailySummary } from "../daily-summary/route";
import { processDeposits } from "../../deposit/process-incoming/route";
import { resolvePendingRounds, ensureActiveRound } from "@/lib/predictions";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * MASTER CRON - UNIFICADO (v1.035)
 * Ejecuta todas las tareas según el horario UTC.
 * Configurar en vercel.json cada 5 o 10 minutos.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // Validar permiso
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
    // 1. Procesar Depósitos (Siempre, cada vez que corre el master cron)
    const depRes = await (await processDeposits()).json();
    report.tasks.push({ name: "process_deposits", result: depRes });

    // 2. Resolver Rondas de Predicción (Cada hora, min 0-10)
    // Aunque sea on-demand, esto asegura que ninguna se quede colgada
    if (minute < 15) {
        const resolved = await resolvePendingRounds();
        await ensureActiveRound("BTC");
        await ensureActiveRound("SOL");
        await ensureActiveRound("BOLIS");
        report.tasks.push({ name: "predictions", resolved });
    }

    // 3. Premios Ranking (Diario, una vez al día a las 00:00 - 00:15 UTC)
    if (hour === 0 && minute < 15) {
        const prizeRes = await awardPrizes();
        report.tasks.push({ name: "award_prizes", result: prizeRes });
    }

    // 4. Resumen Diario Telegram (Diario, una vez al día a las 01:00 UTC)
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
