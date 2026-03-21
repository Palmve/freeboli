import { NextResponse } from "next/server";
import { executeBotCycle } from "@/lib/bot-engine";

export const dynamic = "force-dynamic";

/**
 * Endpoint ligero diseñado para ser invocado frecuentemente.
 * Si el bot no tiene operaciones pendientes (por su temporizador interno),
 * retornará rápidamente sin consumir recursos.
 */
export async function GET(req: Request) {
  try {
    const result = await executeBotCycle();
    
    // Si hubiese devolvido que el bot está desactivado o esperando su turno,
    // igual devolvemos success: true para que no salte alerta en servicios externos.
    return NextResponse.json({
        success: true,
        bot_response: result,
        executed_at: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
        success: false,
        error: error.message
    }, { status: 500 });
  }
}
