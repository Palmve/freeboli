import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: awards } = await supabase
    .from("prize_awards")
    .select("id, user_id, period, period_key, rank, points, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!awards || awards.length === 0) {
    return NextResponse.json({ awards: [] });
  }

  const userIds = [...new Set(awards.map((a) => a.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", userIds);

  const emailMap: Record<string, string> = {};
  (profiles ?? []).forEach((p) => {
    emailMap[p.id] = p.email ?? p.id.slice(0, 8);
  });

  return NextResponse.json({
    awards: awards.map((a) => ({
      id: a.id,
      userId: a.user_id,
      email: emailMap[a.user_id] ?? a.user_id.slice(0, 8),
      period: a.period,
      periodKey: a.period_key,
      rank: a.rank,
      points: a.points,
      createdAt: a.created_at,
    })),
  });
}
