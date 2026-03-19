import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { processDeposits } from "@/lib/cron-tasks";

async function authorize(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  const user = await getCurrentUser();
  return !!user;
}

/** GET — Vercel Cron llama esta ruta una vez al día (Master Cron). */
export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const res = await processDeposits();
  return NextResponse.json(res);
}

/** POST — Botón "Verificar ahora" del panel admin o de usuario. */
export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const res = await processDeposits();
  return NextResponse.json(res);
}
