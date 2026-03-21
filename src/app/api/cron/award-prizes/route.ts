import { NextResponse } from "next/server";
import { awardPrizes } from "@/lib/cron-tasks";
import { requireCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/** Solo automatización: Authorization: Bearer CRON_SECRET (p. ej. curl o job externo). */
export async function GET(req: Request) {
  const denied = requireCronSecret(req);
  if (denied) return denied;
  const res = await awardPrizes();
  return NextResponse.json(res);
}
