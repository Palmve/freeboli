import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { processDeposits } from "@/lib/cron-tasks";
import { rateLimit } from "@/lib/rate-limit";
import { getSetting } from "@/lib/site-settings";

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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Rate Limiting para evitar spam
  const limitMax = await getSetting<number>("DEPOSIT_VERIFY_RATE_MAX", 1);
  const limitWindowMin = await getSetting<number>("DEPOSIT_VERIFY_WINDOW_MIN", 1);
  const { allowed, retryAfterSeconds } = rateLimit(`deposit-verify:${user.id}`, limitMax, limitWindowMin * 60 * 1000);
  
  if (!allowed) {
    return NextResponse.json({ 
        error: `Espera ${retryAfterSeconds} segundos antes de verificar de nuevo.` 
    }, { status: 429 });
  }

  const res = await processDeposits();
  return NextResponse.json(res);
}
