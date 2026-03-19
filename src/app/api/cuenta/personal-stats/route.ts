import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";

type SumMap = Record<string, number>;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const supabase = await createClient();

  const { data: movs } = await supabase
    .from("movements")
    .select("type, points")
    .eq("user_id", user.id);

  const sums: SumMap = {};
  for (const m of movs ?? []) {
    const t = String(m.type);
    sums[t] = (sums[t] ?? 0) + Number(m.points ?? 0);
  }

  const { count: hiLoBets } = await supabase
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", "apuesta_hi_lo");

  const { data: w } = await supabase
    .from("withdrawals")
    .select("points, status")
    .eq("user_id", user.id);

  const totalWithdrawPoints = (w ?? [])
    .filter((x) => x.status === "completed" || x.status === "pending")
    .reduce((s, x) => s + Number(x.points ?? 0), 0);

  return NextResponse.json({
    stats: {
      hiLoBets: hiLoBets ?? 0,
      faucetEarned: sums["faucet"] ?? 0,
      commissionsEarned: sums["comision_afiliado"] ?? 0,
      rankingPrizes: sums["premio_ranking"] ?? 0,
      hiLoPrizes: sums["premio_hi_lo"] ?? 0,
      predictionPrizes: sums["premio_prediccion"] ?? 0,
      rewardsEarned: sums["recompensa"] ?? 0,
      depositsTotal: sums["deposito_bolis"] ?? 0,
      withdrawalsTotal: totalWithdrawPoints,
      paymentsTotal: totalWithdrawPoints,
    },
  });
}

