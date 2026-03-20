import { NextResponse } from "next/server";
import { executeBotCycle } from "@/lib/bot-engine";
import { resolvePendingRounds } from "@/lib/predictions";
import { processDeposits, awardPrizes, runDailySummary } from "@/lib/cron-tasks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Protección por CRON_SECRET (Vercel lo envía en los headers si se configura)
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Opcional: Descomentar para producción estricta
      // return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    steps: {}
  };

  // 1. Depósitos (Barrido de wallets)
  try {
    results.steps.deposits = await processDeposits();
  } catch (e: any) {
    results.steps.deposits = { ok: false, error: e.message };
  }

  // 2. Liquidar rondas de predicción vencidas
  try {
    results.steps.predictions = await resolvePendingRounds();
  } catch (e: any) {
    results.steps.predictions = { ok: false, error: e.message };
  }

  // 3. Ejecutar ciclo del bot (Swaps, volumen, etc.)
  try {
    results.steps.bot = await executeBotCycle();
  } catch (e: any) {
    results.steps.bot = { ok: false, error: e.message };
  }

  // 4. Tareas diarias (Premios a las 00:00 y Resumen a las 01:00 UTC aprox)
  const now = new Date();
  const hour = now.getUTCHours();
  
  if (hour === 0) {
    try {
      results.steps.prizes = await awardPrizes();
    } catch (e: any) {
      results.steps.prizes = { ok: false, error: e.message };
    }
  }
  
  if (hour === 1) {
    try {
      results.steps.summary = await runDailySummary();
    } catch (e: any) {
      results.steps.summary = { ok: false, error: e.message };
    }
  }

  return NextResponse.json({
      success: true,
      results
  });
}
