import { NextResponse } from "next/server";
import { runDailySummary } from "@/lib/cron-tasks";

export async function GET() {
  const res = await runDailySummary();
  if (res.error) return NextResponse.json(res, { status: 500 });
  return NextResponse.json(res);
}
