import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/current-user";
import { getUserLevel } from "@/lib/levels";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "all";

  const supabase = await createClient();
  const currentUserId = await getCurrentUserId();

  let dateFilter: string | null = null;
  const now = new Date();
  if (period === "day") {
    dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    dateFilter = d.toISOString();
  } else if (period === "month") {
    dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  const earnTypes = ["faucet", "premio_hi_lo", "logro", "recompensa", "comision_afiliado", "bonus_referido_verificado"];

  let movQuery = supabase
    .from("movements")
    .select("user_id, points, type")
    .in("type", earnTypes);

  if (dateFilter) {
    movQuery = movQuery.gte("created_at", dateFilter);
  }

  const { data: movements } = await movQuery.limit(50000);

  const earningsByUser: Record<string, number> = {};
  (movements ?? []).forEach((m) => {
    earningsByUser[m.user_id] = (earningsByUser[m.user_id] ?? 0) + (Number(m.points) || 0);
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
    supabase.from("profiles").select("id, name, email, email_verified_at").in("id", allNeededIds),
    supabase.from("movements").select("user_id").eq("type", "apuesta_hi_lo").in("user_id", allNeededIds),
    supabase.from("movements").select("user_id").eq("type", "faucet").in("user_id", allNeededIds),
    supabase.from("referrals").select("referrer_id").in("referrer_id", allNeededIds),
  ]);

  const profileMap: Record<string, { name: string; emailVerified: boolean }> = {};
  (profilesRes.data ?? []).forEach((p) => {
    const displayName = p.name || (p.email ? p.email.split("@")[0].slice(0, 3) + "***" : "Anon");
    profileMap[p.id] = { name: displayName, emailVerified: !!p.email_verified_at };
  });

  const betCountMap: Record<string, number> = {};
  (betsRes.data ?? []).forEach((b) => { betCountMap[b.user_id] = (betCountMap[b.user_id] ?? 0) + 1; });

  const faucetCountMap: Record<string, number> = {};
  (faucetRes.data ?? []).forEach((f) => { faucetCountMap[f.user_id] = (faucetCountMap[f.user_id] ?? 0) + 1; });

  const refCountMap: Record<string, number> = {};
  (referralsRes.data ?? []).forEach((r) => { refCountMap[r.referrer_id] = (refCountMap[r.referrer_id] ?? 0) + 1; });

  function buildEntry(userId: string, rank: number): LeaderboardEntry {
    const p = profileMap[userId] ?? { name: "Anon", emailVerified: false };
    const betCount = betCountMap[userId] ?? 0;
    const faucetClaims = faucetCountMap[userId] ?? 0;
    const referralCount = refCountMap[userId] ?? 0;
    const level = getUserLevel({ betCount, faucetClaims, referralCount, emailVerified: p.emailVerified });
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

  return NextResponse.json({
    top10,
    userSection,
    totalPlayers: sorted.length,
    currentUserRank: currentUserRank >= 0 ? currentUserRank + 1 : null,
    period,
  });
}
