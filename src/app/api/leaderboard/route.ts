import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentUserId } from "@/lib/current-user";
import { getUserLevel } from "@/lib/levels";
import { getSetting } from "@/lib/site-settings";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalEarned: number;
  betCount: number;
  faucetClaims: number;
  referralCount: number;
  level: { level: number; name: string; icon: string; color: string };
  isCurrentUser: boolean;
}

// Cliente con elevación de privilegios (bypassa RLS) esencial para Leaderboards globales
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "all";

  const supabase = supabaseAdmin;
  const currentUserId = await getCurrentUserId();

  let dateFilter: string | null = null;
  const now = new Date();
  // Use UTC so day/week/month are consistent on Vercel (server in UTC)
  if (period === "day") {
    dateFilter = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  } else if (period === "week") {
    const d = new Date(now);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    d.setUTCDate(diff);
    d.setUTCHours(0, 0, 0, 0);
    dateFilter = d.toISOString();
  } else if (period === "month") {
    dateFilter = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }

  const rankingTypes = ["faucet", "apuesta_hi_lo", "apuesta_prediccion", "logro", "recompensa", "comision_afiliado", "bonus_referido_verificado", "premio_ranking"];

  let movQuery = supabase
    .from("movements")
    .select("user_id, points, type")
    .in("type", rankingTypes);

  if (dateFilter) {
    movQuery = movQuery.gte("created_at", dateFilter);
  }

  const { data: movements } = await movQuery.limit(50000);

  const earningsByUser: Record<string, number> = {};
  (movements ?? []).forEach((m) => {
    const pts = Math.abs(Number(m.points) || 0);
    earningsByUser[m.user_id] = (earningsByUser[m.user_id] ?? 0) + pts;
  });

  const sorted = Object.entries(earningsByUser)
    .sort((a, b) => b[1] - a[1]);

  const topIds = sorted.slice(0, 10).map(([id]) => id);

  let currentUserRank = -1;
  let nearbyIds: string[] = [];
  if (currentUserId) {
    currentUserRank = sorted.findIndex(([id]) => id === currentUserId);
    if (currentUserRank > 9) {
      const before = currentUserRank > 0 ? sorted[currentUserRank - 1][0] : null;
      const after = currentUserRank < sorted.length - 1 ? sorted[currentUserRank + 1][0] : null;
      nearbyIds = [before, currentUserId, after].filter(Boolean) as string[];
    }
  }

  const allNeededIds = [...new Set([...topIds, ...nearbyIds])];

  const [profilesRes, betsRes, faucetRes, referralsRes] = await Promise.all([
    supabase.from("profiles").select("id, public_id, email_verified_at").in("id", allNeededIds),
    supabase.from("movements").select("user_id").eq("type", "apuesta_hi_lo").in("user_id", allNeededIds),
    supabase.from("movements").select("user_id").eq("type", "faucet").in("user_id", allNeededIds),
    supabase.from("referrals").select("referrer_id").in("referrer_id", allNeededIds),
  ]);

  const profileMap: Record<string, { name: string; emailVerified: boolean }> = {};
  (profilesRes.data ?? []).forEach((p) => {
    const publicId = p.public_id != null ? String(p.public_id) : null;
    const displayName = publicId ? `#${publicId}` : "—";
    profileMap[p.id] = { name: displayName, emailVerified: !!p.email_verified_at };
  });

  const betCountMap: Record<string, number> = {};
  (betsRes.data ?? []).forEach((b) => { betCountMap[b.user_id] = (betCountMap[b.user_id] ?? 0) + 1; });

  const faucetCountMap: Record<string, number> = {};
  (faucetRes.data ?? []).forEach((f) => { faucetCountMap[f.user_id] = (faucetCountMap[f.user_id] ?? 0) + 1; });

  const refCountMap: Record<string, number> = {};
  (referralsRes.data ?? []).forEach((r) => { refCountMap[r.referrer_id] = (refCountMap[r.referrer_id] ?? 0) + 1; });

  function buildEntry(userId: string, rank: number): LeaderboardEntry {
    const p = profileMap[userId] ?? { name: "—", emailVerified: false };
    const betCount = betCountMap[userId] ?? 0;
    const faucetClaims = faucetCountMap[userId] ?? 0;
    const referralCount = refCountMap[userId] ?? 0;
    const level = getUserLevel({ betCount, faucetClaims, predictionCount: 0, daysSinceJoined: 0, emailVerified: p.emailVerified });
    return {
      rank: rank + 1,
      userId,
      name: p.name,
      totalEarned: earningsByUser[userId] ?? 0,
      betCount,
      faucetClaims,
      referralCount,
      level: { level: level.level, name: level.name, icon: level.icon, color: level.color },
      isCurrentUser: userId === currentUserId,
    };
  }

  const top10: LeaderboardEntry[] = sorted.slice(0, 10).map(([id], i) => buildEntry(id, i));

  let userSection: LeaderboardEntry[] | null = null;
  if (currentUserId && currentUserRank > 9) {
    userSection = [];
    if (currentUserRank > 0) {
      userSection.push(buildEntry(sorted[currentUserRank - 1][0], currentUserRank - 1));
    }
    userSection.push(buildEntry(currentUserId, currentUserRank));
    if (currentUserRank < sorted.length - 1) {
      userSection.push(buildEntry(sorted[currentUserRank + 1][0], currentUserRank + 1));
    }
  }

  const [daily1, daily2, daily3, weekly1, weekly2, weekly3, monthly1, monthly2, monthly3] = await Promise.all([
    getSetting<number>("PRIZE_DAILY_1", 500),
    getSetting<number>("PRIZE_DAILY_2", 300),
    getSetting<number>("PRIZE_DAILY_3", 100),
    getSetting<number>("PRIZE_WEEKLY_1", 5000),
    getSetting<number>("PRIZE_WEEKLY_2", 3000),
    getSetting<number>("PRIZE_WEEKLY_3", 1000),
    getSetting<number>("PRIZE_MONTHLY_1", 25000),
    getSetting<number>("PRIZE_MONTHLY_2", 15000),
    getSetting<number>("PRIZE_MONTHLY_3", 5000),
  ]);

  return NextResponse.json({
    top10,
    userSection,
    totalPlayers: sorted.length,
    currentUserRank: currentUserRank >= 0 ? currentUserRank + 1 : null,
    period,
    prizes: {
      daily: [daily1, daily2, daily3],
      weekly: [weekly1, weekly2, weekly3],
      monthly: [monthly1, monthly2, monthly3],
    },
  });
}
