import { NextResponse } from "next/server";
import { executeBotCycle } from "@/lib/bot-engine";
import { requireCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Endpoint ligero diseñado para ser invocado frecuentemente.
 * Si el bot no tiene operaciones pendientes (por su temporizador interno),
 * retornará rápidamente sin consumir recursos.
 */
export async function GET(req: Request) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  try {
    const result = await executeBotCycle();

    // Monitoreo Telegram apoyado en este tick horario (GitHub Actions corre
    // cada hora, a diferencia del cron de Vercel que solo dispara a las 00:00):
    //  - 01:00 UTC → resumen diario (idempotente).
    //  - 06/12/18 UTC → pulso de actividad cada 6h.
    let monitor: unknown = null;
    try {
      const hour = new Date().getUTCHours();
      const { runDailySummary, runActivityPulse } = await import("@/lib/cron-tasks");
      if (hour === 1) monitor = await runDailySummary();
      else if (hour === 6 || hour === 12 || hour === 18) monitor = await runActivityPulse(6);
    } catch (e) {
      console.error("[Monitor] Error en tarea de monitoreo:", e);
    }

    // Si hubiese devolvido que el bot está desactivado o esperando su turno,
    // igual devolvemos success: true para que no salte alerta en servicios externos.
    return NextResponse.json({
        success: true,
        bot_response: result,
        monitor,
        executed_at: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
        success: false,
        error: error.message
    }, { status: 500 });
  }
}
