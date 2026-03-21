"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/current-user";
import { awardPrizes, runDailySummary } from "@/lib/cron-tasks";

type Fail = { ok: false; error: string };

export async function runAwardPrizesFromAdmin(): Promise<
  { ok: true; data: Awaited<ReturnType<typeof awardPrizes>> } | Fail
> {
  const user = await getAdminUser();
  if (!user) return { ok: false, error: "No autorizado." };
  try {
    const data = await awardPrizes();
    revalidatePath("/admin/ranking");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runDailySummaryFromAdmin(): Promise<
  { ok: true; data: Awaited<ReturnType<typeof runDailySummary>> } | Fail
> {
  const user = await getAdminUser();
  if (!user) return { ok: false, error: "No autorizado." };
  try {
    const data = await runDailySummary();
    revalidatePath("/admin/alertas");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
