import { NextResponse } from "next/server";
import { executeBotCycle } from "@/lib/bot-engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Opcional: Proteger con un CRON_SECRET en los headers para que solo Vercel pueda llamarlo
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await executeBotCycle();
  return NextResponse.json(result);
}
