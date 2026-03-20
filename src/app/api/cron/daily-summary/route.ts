import { NextResponse } from "next/server";
import { runDailySummary } from "@/lib/cron-tasks";

export const dynamic = "force-dynamic";

/** 
 * Permite disparar el resumen diario manualmente desde el panel admin.
 * Verificado por el middleware de sesión en la ruta admin/.
 */
export async function GET() {
  const res = await runDailySummary();
  return NextResponse.json(res);
}
