import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendDailySummary, sendTelegramMessage } from "@/lib/telegram";

export async function GET() {
  const supabase = await createClient();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  try {
    const [
      newUsersRes,
      activeUsersRes,
      betsRes,
      faucetRes,
      withdrawalsRes,
      depositsRes,
      revenueRes,
      costRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", todayStart.toISOString()),
      supabase
        .from("movements")
        .select("user_id")
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", todayStart.toISOString()),
      supabase
        .from("movements")
        .select("id", { count: "exact", head: true })
        .in("type", ["apuesta_hi_lo", "apuesta_prediccion"])
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", todayStart.toISOString()),
      supabase
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("type", "faucet")
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", todayStart.toISOString()),
      supabase
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("type", "retiro_bolis")
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", todayStart.toISOString()),
      supabase
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("type", "deposito_bolis")
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", todayStart.toISOString()),
      supabase
        .from("movements")
        .select("points")
        .in("type", ["apuesta_hi_lo", "apuesta_prediccion"])
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", todayStart.toISOString()),
      supabase
        .from("movements")
        .select("points, type")
        .in("type", ["faucet", "premio_hi_lo", "premio_prediccion", "comision_afiliado", "logro", "recompensa", "bonus_referido_verificado", "premio_ranking"])
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", todayStart.toISOString()),
    ]);

    const uniqueActiveUsers = new Set((activeUsersRes.data ?? []).map((m) => m.user_id)).size;

    const revenue = (revenueRes.data ?? []).reduce((s, m) => s + Math.abs(Number(m.points) || 0), 0);
    const costs = (costRes.data ?? []).reduce((s, m) => s + (Number(m.points) || 0), 0);
    const platformBalance = revenue - costs;

    await sendDailySummary({
      newUsers: newUsersRes.count ?? 0,
      activeUsers: uniqueActiveUsers,
      totalBets: betsRes.count ?? 0,
      totalFaucetClaims: faucetRes.count ?? 0,
      withdrawalRequests: withdrawalsRes.count ?? 0,
      depositCount: depositsRes.count ?? 0,
      platformBalance,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`❌ Error en resumen diario: ${msg}`, "critical");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
