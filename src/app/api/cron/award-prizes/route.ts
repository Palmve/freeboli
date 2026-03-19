import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/site-settings";

const RANKING_TYPES = ["faucet", "apuesta_hi_lo", "apuesta_prediccion", "logro", "recompensa", "comision_afiliado", "bonus_referido_verificado"];

interface PrizeConfig {
  period: "daily" | "weekly" | "monthly";
  periodKey: string;
  dateFrom: string;
  dateTo: string;
  prizes: { rank: number; settingKey: string; fallback: number }[];
}

function getPrizeConfigs(now: Date): PrizeConfig[] {
  const configs: PrizeConfig[] = [];

  // Daily: award for yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  const yStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  const yEnd = new Date(yStart);
  yEnd.setDate(yEnd.getDate() + 1);
  configs.push({
    period: "daily",
    periodKey: yKey,
    dateFrom: yStart.toISOString(),
    dateTo: yEnd.toISOString(),
    prizes: [
      { rank: 1, settingKey: "PRIZE_DAILY_1", fallback: 500 },
      { rank: 2, settingKey: "PRIZE_DAILY_2", fallback: 300 },
      { rank: 3, settingKey: "PRIZE_DAILY_3", fallback: 100 },
    ],
  });

  // Weekly: if today is Monday, award for previous week (Mon-Sun)
  if (now.getDay() === 1) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now);
    weekEnd.setHours(0, 0, 0, 0);
    const wKey = `W${weekStart.toISOString().slice(0, 10)}`;
    configs.push({
      period: "weekly",
      periodKey: wKey,
      dateFrom: weekStart.toISOString(),
      dateTo: weekEnd.toISOString(),
      prizes: [
        { rank: 1, settingKey: "PRIZE_WEEKLY_1", fallback: 5000 },
        { rank: 2, settingKey: "PRIZE_WEEKLY_2", fallback: 3000 },
        { rank: 3, settingKey: "PRIZE_WEEKLY_3", fallback: 1000 },
      ],
    });
  }

  // Monthly: if today is 1st, award for previous month
  if (now.getDate() === 1) {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const mKey = `M${prevMonth.toISOString().slice(0, 7)}`;
    configs.push({
      period: "monthly",
      periodKey: mKey,
      dateFrom: prevMonth.toISOString(),
      dateTo: monthEnd.toISOString(),
      prizes: [
        { rank: 1, settingKey: "PRIZE_MONTHLY_1", fallback: 25000 },
        { rank: 2, settingKey: "PRIZE_MONTHLY_2", fallback: 15000 },
        { rank: 3, settingKey: "PRIZE_MONTHLY_3", fallback: 5000 },
      ],
    });
  }

  return configs;
}

export async function awardPrizes() {
  const supabase = await createClient();
  const now = new Date();
  const configs = getPrizeConfigs(now);
  const results: string[] = [];

  for (const cfg of configs) {
    // ... rest of logic
    // Check if prizes already awarded for this period
    const { count: existing } = await supabase
      .from("prize_awards")
      .select("id", { count: "exact", head: true })
      .eq("period", cfg.period)
      .eq("period_key", cfg.periodKey);

    if ((existing ?? 0) > 0) {
      results.push(`${cfg.period}/${cfg.periodKey}: ya otorgado`);
      continue;
    }

    // Get top earners for the period
    const { data: movements } = await supabase
      .from("movements")
      .select("user_id, points")
      .in("type", RANKING_TYPES)
      .gte("created_at", cfg.dateFrom)
      .lt("created_at", cfg.dateTo)
      .limit(50000);

    const earningsByUser: Record<string, number> = {};
    (movements ?? []).forEach((m) => {
      const pts = Math.abs(Number(m.points) || 0);
      earningsByUser[m.user_id] = (earningsByUser[m.user_id] ?? 0) + pts;
    });

    const sorted = Object.entries(earningsByUser).sort((a, b) => b[1] - a[1]);

    for (const prize of cfg.prizes) {
      if (sorted.length < prize.rank) continue;
      const [userId] = sorted[prize.rank - 1];
      const points = await getSetting<number>(prize.settingKey, prize.fallback);

      // Award prize
      await supabase.from("prize_awards").insert({
        user_id: userId,
        period: cfg.period,
        period_key: cfg.periodKey,
        rank: prize.rank,
        points,
      });

      // Add points to user balance
      const { data: bal } = await supabase
        .from("balances")
        .select("points")
        .eq("user_id", userId)
        .single();

      const currentPts = Number(bal?.points ?? 0);
      await supabase
        .from("balances")
        .upsert({ user_id: userId, points: currentPts + points }, { onConflict: "user_id" });

      // Record movement
      await supabase.from("movements").insert({
        user_id: userId,
        type: "premio_ranking",
        points,
        reference: `${cfg.period}:${cfg.periodKey}:rank${prize.rank}`,
      });

      results.push(`${cfg.period}/${cfg.periodKey} #${prize.rank}: ${points} pts -> ${userId.slice(0, 8)}`);
    }
  }

  return { ok: true, results };
}

export async function GET() {
  const res = await awardPrizes();
  return NextResponse.json(res);
}
