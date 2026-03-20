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

  // 1. Liquidar rondas de predicción vencidas
  const resolved = await resolvePendingRounds().catch(e => {
      console.error("Error resolving rounds via cron:", e);
      return 0;
  });

  // 2. Ejecutar ciclo del bot (Swaps, volumen, etc.)
  const botResult = await executeBotCycle();

  return NextResponse.json({
      success: true,
      resolved_rounds: resolved,
      bot_execution: botResult
  });
}
