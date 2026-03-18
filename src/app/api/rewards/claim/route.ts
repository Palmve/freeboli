import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/current-user";
import { getSetting } from "@/lib/site-settings";
import { AFFILIATE_ACHIEVEMENT_PERCENT } from "@/lib/config";

interface AchievementCheck {
  code: string;
  check: (userId: string, supabase: Awaited<ReturnType<typeof createClient>>) => Promise<boolean>;
}

const achievements: AchievementCheck[] = [
  {
    code: "email_verified",
    check: async (userId, sb) => {
      const { data } = await sb
        .from("profiles")
        .select("email_verified_at")
        .eq("id", userId)
        .single();
      return !!data?.email_verified_at;
    },
  },
  {
    code: "first_bet",
    check: async (userId, sb) => {
      const { count } = await sb
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "apuesta_hi_lo");
      return (count ?? 0) >= 1;
    },
  },
  {
    code: "bets_100",
    check: async (userId, sb) => {
      const { count } = await sb
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "apuesta_hi_lo");
      return (count ?? 0) >= 100;
    },
  },
  {
    code: "bets_1000",
    check: async (userId, sb) => {
      const { count } = await sb
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "apuesta_hi_lo");
      return (count ?? 0) >= 1000;
    },
  },
  {
    code: "bets_10000",
    check: async (userId, sb) => {
      const { count } = await sb
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "apuesta_hi_lo");
      return (count ?? 0) >= 10000;
    },
  },
  {
    code: "first_referral",
    check: async (userId, sb) => {
      const { data: refs } = await sb
        .from("referrals")
        .select("referred_id")
        .eq("referrer_id", userId);
      if (!refs || refs.length === 0) return false;
      for (const r of refs) {
        const { data: p } = await sb
          .from("profiles")
          .select("email_verified_at")
          .eq("id", r.referred_id)
          .single();
        if (p?.email_verified_at) return true;
      }
      return false;
    },
  },
];

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("reward_templates")
    .select("id, code, name, description, points_reward")
    .not("code", "eq", "referral_verified");

  const { data: claimed } = await supabase
    .from("user_rewards")
    .select("reward_template_id")
    .eq("user_id", userId);

  const claimedIds = new Set((claimed ?? []).map((c) => c.reward_template_id));

  const { count: betCount } = await supabase
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "apuesta_hi_lo");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_verified_at")
    .eq("id", userId)
    .single();

  const { data: referrals } = await supabase
    .from("referrals")
    .select("referred_id")
    .eq("referrer_id", userId);

  let verifiedReferrals = 0;
  if (referrals && referrals.length > 0) {
    for (const r of referrals) {
      const { data: rp } = await supabase
        .from("profiles")
        .select("email_verified_at")
        .eq("id", r.referred_id)
        .single();
      if (rp?.email_verified_at) verifiedReferrals++;
    }
  }

  const items = (templates ?? []).map((t) => {
    let progress = 0;
    let target = 1;
    switch (t.code) {
      case "email_verified":
        progress = profile?.email_verified_at ? 1 : 0;
        break;
      case "first_bet":
        progress = Math.min(betCount ?? 0, 1);
        break;
      case "bets_100":
        progress = Math.min(betCount ?? 0, 100);
        target = 100;
        break;
      case "bets_1000":
        progress = Math.min(betCount ?? 0, 1000);
        target = 1000;
        break;
      case "bets_10000":
        progress = Math.min(betCount ?? 0, 10000);
        target = 10000;
        break;
      case "first_referral":
        progress = Math.min(verifiedReferrals, 1);
        break;
    }
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      points: t.points_reward,
      claimed: claimedIds.has(t.id),
      progress,
      target,
    };
  });

  return NextResponse.json({ achievements: items });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { code } = await request.json().catch(() => ({ code: "" }));
  if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 });

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("reward_templates")
    .select("id, code, points_reward")
    .eq("code", code)
    .single();

  if (!template) return NextResponse.json({ error: "Logro no encontrado" }, { status: 404 });

  const { data: existing } = await supabase
    .from("user_rewards")
    .select("id")
    .eq("user_id", userId)
    .eq("reward_template_id", template.id)
    .single();

  if (existing) return NextResponse.json({ error: "Ya reclamaste este logro" }, { status: 409 });

  const achievement = achievements.find((a) => a.code === code);
  if (!achievement) return NextResponse.json({ error: "Logro no verificable" }, { status: 400 });

  const eligible = await achievement.check(userId, supabase);
  if (!eligible) return NextResponse.json({ error: "Aún no cumples el requisito" }, { status: 403 });

  await supabase.from("user_rewards").insert({
    user_id: userId,
    reward_template_id: template.id,
  });

  const { data: bal } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", userId)
    .single();

  const newPoints = Number(bal?.points ?? 0) + Number(template.points_reward);
  await supabase.from("balances").upsert(
    { user_id: userId, points: newPoints, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  await supabase.from("movements").insert({
    user_id: userId,
    type: "logro",
    points: Number(template.points_reward),
    reference: template.code,
    metadata: { achievement: template.code },
  });

  // --- Affiliate commission on achievement ---
  const achPercent = await getSetting<number>("AFFILIATE_ACHIEVEMENT_PERCENT", AFFILIATE_ACHIEVEMENT_PERCENT);
  if (achPercent > 0) {
    const { data: ref } = await supabase
      .from("referrals")
      .select("referrer_id")
      .eq("referred_id", userId)
      .single();
    if (ref?.referrer_id) {
      const commission = Math.floor((Number(template.points_reward) * achPercent) / 100);
      if (commission > 0) {
        const { data: refBal } = await supabase
          .from("balances")
          .select("points")
          .eq("user_id", ref.referrer_id)
          .single();
        const refNew = Number(refBal?.points ?? 0) + commission;
        await supabase.from("balances").upsert(
          { user_id: ref.referrer_id, points: refNew, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        await supabase.from("movements").insert({
          user_id: ref.referrer_id,
          type: "comision_afiliado",
          points: commission,
          reference: userId,
          metadata: { source: "achievement", achievement: template.code, referred_user: userId },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, points: Number(template.points_reward), totalPoints: newPoints });
}
