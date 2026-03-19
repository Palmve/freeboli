import { NextResponse } from "next/server";
import { resolvePendingRounds, ensureActiveRound } from "@/lib/predictions";

export const dynamic = "force-dynamic";

/**
 * Endpoint de resolución horaria.
 * Debe llamarse cada hora al minuto 0.
 */
export async function GET(req: Request) {
  // Opcional: Validar SECRET para cron
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const resolvedCount = await resolvePendingRounds();
    
    // Asegurar que existan las rondas de la nueva hora
    await ensureActiveRound("BTC");
    await ensureActiveRound("SOL");

    return NextResponse.json({ 
      success: true, 
      resolved: resolvedCount,
      message: "Procesamiento horario completado."
    });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Error en el procesamiento." }, { status: 500 });
  }
}
