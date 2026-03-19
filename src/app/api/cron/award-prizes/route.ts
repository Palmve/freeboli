import { NextResponse } from "next/server";
import { awardPrizes } from "@/lib/cron-tasks";

export async function GET() {
  const res = await awardPrizes();
  return NextResponse.json(res);
}
