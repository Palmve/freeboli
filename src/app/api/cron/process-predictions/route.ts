import { NextResponse } from "next/server";
import { resolvePendingRounds, ensureActiveRound } from "@/lib/predictions";

export const dynamic = "force-dynamic";

/**
 * Endpoint de resolución horaria.
 * Debe llamarse cada hora al minuto 0.
 */
export async function GET(req: Request) {
  // Validar SECRET para cron (query param o header Authorization)
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && secret !== expectedSecret && bearerToken !== expectedSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const resolvedCount = await resolvePendingRounds();
    
    // Asegurar que existan las rondas de la nueva hora para todos los activos
    await ensureActiveRound("BTC");
    await ensureActiveRound("SOL");
    await ensureActiveRound("BOLIS");

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
