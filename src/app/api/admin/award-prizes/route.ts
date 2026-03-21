import { NextResponse } from "next/server";
import { awardPrizes } from "@/lib/cron-tasks";
import { getAdminUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

/** Disparo manual desde el panel (misma auth que el resto de /api/admin/*). */
export async function GET() {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const res = await awardPrizes();
  return NextResponse.json(res);
}
