import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getUserLevel } from "@/lib/levels";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const supabase = await createClient();

  const [profileRes, faucetRes, betsRes] = await Promise.all([
    supabase.from("profiles").select("email_verified_at, public_id, referral_code, created_at").eq("id", user.id).single(),
    supabase.from("movements").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("type", "faucet"),
    supabase.from("movements").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("type", "apuesta_hi_lo"),
  ]);

  const daysSinceJoined = profileRes.data?.created_at
    ? Math.floor((Date.now() - new Date(profileRes.data.created_at).getTime()) / 86400000)
    : 0;

  const stats = {
    betCount: betsRes.count ?? 0,
    faucetClaims: faucetRes.count ?? 0,
    predictionCount: 0,
    daysSinceJoined,
    emailVerified: !!profileRes.data?.email_verified_at,
  };

  const level = getUserLevel(stats);

  return NextResponse.json({
    user: {
      id: user.id,
      publicId: profileRes.data?.public_id ?? null,
      referralCode: profileRes.data?.referral_code ?? null,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    },
    level: {
      level: level.level,
      name: level.name,
      icon: level.icon,
      color: level.color,
    },
    stats,
  });
}
