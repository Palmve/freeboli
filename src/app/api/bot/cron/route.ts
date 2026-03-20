import { NextResponse } from "next/server";
import { executeBotCycle } from "@/lib/bot-engine";
import { resolvePendingRounds } from "@/lib/predictions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Opcional: Proteger con un CRON_SECRET en los headers
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 1. Depósitos (Barrido)
  const { processDeposits, awardPrizes, runDailySummary } = await import("@/lib/cron-tasks");
  await processDeposits().catch(e => console.error("Deposits error:", e));

  // 2. Liquidar rondas de predicción vencidas
  const resolved = await resolvePendingRounds().catch(e => {
      console.error("Error resolving rounds via cron:", e);
      return 0;
  });

  // 3. Ejecutar ciclo del bot (Swaps, volumen, etc.)
  const botResult = await executeBotCycle();

  // 4. Tareas diarias (Premios a las 00:00 y Resumen a las 01:00 UTC aprox)
  const now = new Date();
  const hour = now.getUTCHours();
  if (hour === 0) await awardPrizes().catch(e => console.error("Prizes error:", e));
  if (hour === 1) await runDailySummary().catch(e => console.error("Summary error:", e));

  return NextResponse.json({
      success: true,
      resolved_rounds: resolved,
      bot_execution: botResult,
      timestamp: now.toISOString()
  });
}
