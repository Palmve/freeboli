import { NextResponse } from "next/server";
import { executeBotCycle } from "@/lib/bot-engine";
import { resolvePendingRounds } from "@/lib/predictions";
import { processDeposits, awardPrizes, runDailySummary } from "@/lib/cron-tasks";
import { requireCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

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
