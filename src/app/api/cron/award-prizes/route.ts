import { NextResponse } from "next/server";
import { awardPrizes } from "@/lib/cron-tasks";

export const dynamic = "force-dynamic";

/** 
 * Permite disparar el otorgamiento de premios manualmente desde el panel admin.
 * Verificado por el middleware de sesión en la ruta admin/.
 */
export async function GET() {
  const res = await awardPrizes();
  return NextResponse.json(res);
}
