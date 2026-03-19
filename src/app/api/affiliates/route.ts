import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/current-user";
import { getSetting } from "@/lib/site-settings";
import {
  AFFILIATE_COMMISSION_PERCENT,
  AFFILIATE_ACHIEVEMENT_PERCENT,
  REFERRAL_VERIFIED_BONUS,
  REFERRAL_MIN_BETS,
  REFERRAL_MIN_DAYS,
} from "@/lib/config";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createClient();
  const { data: me } = await supabase.from("profiles").select("public_id, referral_code").eq("id", userId).single();

  const minBets = await getSetting<number>("REFERRAL_MIN_BETS", REFERRAL_MIN_BETS);
  const minDays = await getSetting<number>("REFERRAL_MIN_DAYS", REFERRAL_MIN_DAYS);

  const { data: referrals } = await supabase
    .from("referrals")
    .select("referred_id, created_at")
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false });

  // Check which bonuses have already been claimed
  const { data: claimedBonuses } = await supabase
    .from("movements")
    .select("reference")
    .eq("user_id", userId)
    .eq("type", "bonus_referido_verificado");

  const claimedSet = new Set((claimedBonuses ?? []).map((m) => m.reference));

  const referralList: {
    referredId: string;
    email: string;
    date: string;
    verified: boolean;
    bets: number;
    daysRegistered: number;
    pointsGenerated: number;
    bonusEligible: boolean;
    bonusClaimed: boolean;
  }[] = [];

  let totalVerified = 0;
  const now = new Date();

  for (const ref of referrals ?? []) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, email_verified_at, created_at")
      .eq("id", ref.referred_id)
      .single();

    const { count: betCount } = await supabase
      .from("movements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ref.referred_id)
      .eq("type", "apuesta_hi_lo");

    const { data: commissions } = await supabase
      .from("movements")
      .select("points")
      .eq("user_id", userId)
      .eq("type", "comision_afiliado")
      .eq("reference", ref.referred_id);

    const pointsGen = (commissions ?? []).reduce((s, m) => s + Number(m.points), 0);
    const email = profile?.email ?? "";
    const parts = email.split("@");
    const masked = parts[0].slice(0, 2) + "***@" + (parts[1] ?? "");
    const verified = !!profile?.email_verified_at;
    if (verified) totalVerified++;

    const registeredAt = profile?.created_at ? new Date(profile.created_at) : now;
    const daysRegistered = Math.floor((now.getTime() - registeredAt.getTime()) / (24 * 60 * 60 * 1000));
    const bets = betCount ?? 0;

    const bonusClaimed = claimedSet.has(ref.referred_id);
    const bonusEligible = verified && bets >= minBets && daysRegistered >= minDays && !bonusClaimed;

    referralList.push({
      referredId: ref.referred_id,
      email: masked,
      date: ref.created_at,
      verified,
      bets,
      daysRegistered,
      pointsGenerated: pointsGen,
      bonusEligible,
      bonusClaimed,
    });
  }

  const { data: totalComm } = await supabase
    .from("movements")
    .select("points")
    .eq("user_id", userId)
    .eq("type", "comision_afiliado");

  const totalCommissions = (totalComm ?? []).reduce((s, m) => s + Number(m.points), 0);

  const { data: bonusMov } = await supabase
    .from("movements")
    .select("points")
    .eq("user_id", userId)
    .eq("type", "bonus_referido_verificado");

  const totalBonusPoints = (bonusMov ?? []).reduce((s, m) => s + Number(m.points), 0);

  const commissionPercent = await getSetting<number>("AFFILIATE_COMMISSION_PERCENT", AFFILIATE_COMMISSION_PERCENT);
  const achievementPercent = await getSetting<number>("AFFILIATE_ACHIEVEMENT_PERCENT", AFFILIATE_ACHIEVEMENT_PERCENT);
  const verifiedBonus = await getSetting<number>("REFERRAL_VERIFIED_BONUS", REFERRAL_VERIFIED_BONUS);

  return NextResponse.json({
    referrals: referralList,
    totalReferrals: referralList.length,
    totalVerified,
    totalCommissions,
    totalBonusPoints,
    commissionPercent,
    achievementPercent,
    verifiedBonus,
    minBets,
    minDays,
    userId,
    referralCode: me?.referral_code ?? (me?.public_id != null ? String(me.public_id) : null),
  });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { referredId } = await request.json().catch(() => ({ referredId: "" }));
  if (!referredId) return NextResponse.json({ error: "referredId requerido" }, { status: 400 });

  const supabase = await createClient();
  const now = new Date();

  const minBets = await getSetting<number>("REFERRAL_MIN_BETS", REFERRAL_MIN_BETS);
  const minDays = await getSetting<number>("REFERRAL_MIN_DAYS", REFERRAL_MIN_DAYS);
  const bonusAmount = await getSetting<number>("REFERRAL_VERIFIED_BONUS", REFERRAL_VERIFIED_BONUS);

  // Verify referral relationship exists
  const { data: ref } = await supabase
    .from("referrals")
    .select("id")
    .eq("referrer_id", userId)
    .eq("referred_id", referredId)
    .single();

  if (!ref) return NextResponse.json({ error: "Referido no encontrado" }, { status: 404 });

  // Check not already claimed
  const { data: existing } = await supabase
    .from("movements")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "bonus_referido_verificado")
    .eq("reference", referredId)
    .single();

  if (existing) return NextResponse.json({ error: "Ya reclamaste este bonus" }, { status: 409 });

  // Verify referred user meets requirements
  const { data: profile } = await supabase
    .from("profiles")
    .select("email_verified_at, created_at")
    .eq("id", referredId)
    .single();

  if (!profile?.email_verified_at) {
    return NextResponse.json({ error: "El referido aún no ha verificado su correo" }, { status: 403 });
  }

  const registeredAt = profile.created_at ? new Date(profile.created_at) : now;
  const daysRegistered = Math.floor((now.getTime() - registeredAt.getTime()) / (24 * 60 * 60 * 1000));
  if (daysRegistered < minDays) {
    return NextResponse.json(
      { error: `El referido debe llevar al menos ${minDays} días registrado` },
      { status: 403 }
    );
  }

  const { count: betCount } = await supabase
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", referredId)
    .eq("type", "apuesta_hi_lo");

  if ((betCount ?? 0) < minBets) {
    return NextResponse.json(
      { error: `El referido necesita al menos ${minBets} apuestas en HI-LO (tiene ${betCount ?? 0})` },
      { status: 403 }
    );
  }

  // Grant bonus
  const { data: bal } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", userId)
    .single();

  const newPoints = Number(bal?.points ?? 0) + bonusAmount;

  await supabase.from("balances").upsert(
    { user_id: userId, points: newPoints, updated_at: now.toISOString() },
    { onConflict: "user_id" }
  );

  await supabase.from("movements").insert({
    user_id: userId,
    type: "bonus_referido_verificado",
    points: bonusAmount,
    reference: referredId,
    metadata: { referred_user: referredId, bets: betCount, days: daysRegistered },
  });

  return NextResponse.json({ ok: true, points: bonusAmount, totalPoints: newPoints });
}
