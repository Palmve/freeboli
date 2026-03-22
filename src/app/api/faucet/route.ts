import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId, getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { getRequestIp, getRequestIpHash } from "@/lib/ip";
import { getSetting } from "@/lib/site-settings";
import { rateLimit } from "@/lib/rate-limit";
import {
  FAUCET_POINTS,
  FAUCET_COOLDOWN_HOURS,
  MAX_SESSIONS_PER_IP,
  POINTS_PER_BOLIS,
  AFFILIATE_FAUCET_PERCENT,
  CAPTCHA_INTERVAL,
  FAUCET_ENGAGEMENT_EVERY,
} from "@/lib/config";
import { generateCaptcha, verifyCaptcha } from "@/lib/captcha";
import {
  calculatePayout,
  isHourlyStreakBroken,
  isDailyStreakBroken,
  getTodayUTC,
  DEFAULT_HOURLY_TIERS,
  DEFAULT_DAILY_TIERS,
} from "@/lib/streaks";
// ... (rest of imports)

async function getConfig() {
  const base = await getSetting<number>("FAUCET_POINTS", FAUCET_POINTS);
  const cooldown = await getSetting<number>("FAUCET_COOLDOWN_HOURS", FAUCET_COOLDOWN_HOURS);
  const commission = await getSetting<number>("AFFILIATE_FAUCET_PERCENT", AFFILIATE_FAUCET_PERCENT);
  const captchaEvery = await getSetting<number>("CAPTCHA_INTERVAL", CAPTCHA_INTERVAL);
  const engagementEvery = await getSetting<number>("FAUCET_ENGAGEMENT_EVERY", FAUCET_ENGAGEMENT_EVERY);
  const maxSessionsPerIp = await getSetting<number>("MAX_SESSIONS_PER_IP", MAX_SESSIONS_PER_IP);
  const hourlyTiers = await getSetting("HOURLY_STREAK_TIERS", DEFAULT_HOURLY_TIERS);
  const dailyTiers = await getSetting("DAILY_STREAK_TIERS", DEFAULT_DAILY_TIERS);
  return { base, cooldown, commission, captchaEvery, engagementEvery, maxSessionsPerIp, hourlyTiers, dailyTiers };
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(currentUser.status)) {
    return NextResponse.json({ error: "Tu cuenta está suspendida o bloqueada." }, { status: 403 });
  }
  const userId = currentUser.id;

  // Límite de ráfaga para bloquear scripts concurrentes por ID (1 petición por 5 segundos)
  const { allowed } = rateLimit(`faucet:${userId}`, 1, 5000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Procesando pago, espera unos segundos..." },
      { status: 429 } 
    );
  }

  const supabase = await createClient();
  const ipHash = await getRequestIpHash();
  const cfg = await getConfig();

  // --- Require verified email ---
  const { data: profile } = await supabase
    .from("profiles")
    .select("email_verified_at")
    .eq("id", userId)
    .single();
  if (!profile?.email_verified_at) {
    return NextResponse.json(
      { error: "Verifica tu correo electrónico para poder reclamar el faucet.", requireEmailVerification: true },
      { status: 403 }
    );
  }

  // --- IP session limit ---
  const { data: sessionIps } = await supabase
    .from("session_ips")
    .select("user_id")
    .eq("ip_hash", ipHash);
  const uniqueUsers = new Set(sessionIps?.map((s) => s.user_id) ?? []);
  if (!uniqueUsers.has(userId)) {
    if (uniqueUsers.size >= cfg.maxSessionsPerIp) {
      return NextResponse.json(
        { error: "Límite de conexiones por IP alcanzado." },
        { status: 429 }
      );
    }
    await supabase.from("session_ips").upsert(
      { user_id: userId, ip_hash: ipHash, last_seen: new Date().toISOString() },
      { onConflict: "user_id,ip_hash" }
    );
  } else {
    await supabase
      .from("session_ips")
      .update({ last_seen: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("ip_hash", ipHash);
  }

  // --- Fetch current claim state ---
  const { data: claim } = await supabase
    .from("faucet_claims")
    .select("last_claim_at, hourly_streak, daily_streak, last_streak_date, claims_since_captcha")
    .eq("user_id", userId)
    .single();

  const now = new Date();
  const last = claim?.last_claim_at ? new Date(claim.last_claim_at) : null;
  const cooldownMs = cfg.cooldown * 60 * 60 * 1000;

  if (last && now.getTime() - last.getTime() < cooldownMs) {
    const wait = Math.ceil((cooldownMs - (now.getTime() - last.getTime())) / 1000);
    return NextResponse.json(
      { error: "Espera antes de reclamar de nuevo.", waitSeconds: wait },
      { status: 429 }
    );
  }

  // --- Engagement check: require HI-LO activity every N claims ---
  const totalClaims = (claim?.hourly_streak ?? 0) + 1;
  if (totalClaims > 1 && totalClaims % cfg.engagementEvery === 0) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentBets } = await supabase
      .from("movements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "apuesta_hi_lo")
      .gte("created_at", yesterday);
    if ((recentBets ?? 0) < 1) {
      return NextResponse.json(
        {
          error: "Para seguir reclamando, juega al menos 1 partida de HI-LO en las últimas 24 horas.",
          requireEngagement: true,
        },
        { status: 403 }
      );
    }
  }

  // --- CAPTCHA check ---
  const claimsSinceCaptcha = claim?.claims_since_captcha ?? 0;
  const needsCaptcha = claimsSinceCaptcha >= cfg.captchaEvery;

  if (needsCaptcha) {
    let body: { captchaAnswer?: number; captchaToken?: string } = {};
    try { body = await request.json(); } catch { /* no body */ }

    if (!body.captchaToken || body.captchaAnswer == null) {
      const challenge = generateCaptcha(claimsSinceCaptcha);
      return NextResponse.json(
        { requireCaptcha: true, captcha: challenge },
        { status: 200 }
      );
    }

    const result = verifyCaptcha(body.captchaAnswer, body.captchaToken);
    if (!result.valid) {
      const challenge = generateCaptcha(claimsSinceCaptcha);
      return NextResponse.json(
        { requireCaptcha: true, captcha: challenge, captchaError: result.reason },
        { status: 200 }
      );
    }
  }

  // --- Calculate streaks ---
  let hourlyStreak = (claim?.hourly_streak ?? 0) + 1;
  let dailyStreak = claim?.daily_streak ?? 0;
  const lastStreakDate = claim?.last_streak_date ?? null;
  const today = getTodayUTC();

  if (isHourlyStreakBroken(last, cooldownMs)) hourlyStreak = 1;
  if (isDailyStreakBroken(lastStreakDate)) {
    dailyStreak = 1;
  } else if (lastStreakDate !== today) {
    dailyStreak += 1;
  }

  const { payout, hourlyMultiplier, dailyBonus } = calculatePayout(
    cfg.base, hourlyStreak, dailyStreak, cfg.hourlyTiers, cfg.dailyTiers
  );

  // --- Update balance atomically ---
  const { data: addData, error: addError } = await supabase.rpc("atomic_add_points", {
    target_user_id: userId,
    amount_to_add: payout
  });

  if (addError || !addData?.[0]?.success) {
    return NextResponse.json({ error: "Error de servidor procesando los fondos. Intenta más tarde." }, { status: 500 });
  }

  const newPoints = Number(addData[0].result_balance);

  await supabase.from("movements").insert({
    user_id: userId,
    type: "faucet",
    points: payout,
    reference: null,
    metadata: { hourlyStreak, dailyStreak, multiplier: hourlyMultiplier, dailyBonus },
  });

  const newCaptchaCount = needsCaptcha ? 1 : claimsSinceCaptcha + 1;

  await supabase.from("faucet_claims").upsert(
    {
      user_id: userId,
      last_claim_at: now.toISOString(),
      hourly_streak: hourlyStreak,
      daily_streak: dailyStreak,
      last_streak_date: today,
      claims_since_captcha: newCaptchaCount,
    },
    { onConflict: "user_id" }
  );

  // --- Affiliate commission ---
  if (cfg.commission > 0) {
    const { data: ref } = await supabase
      .from("referrals")
      .select("referrer_id")
      .eq("referred_id", userId)
      .single();
    if (ref?.referrer_id) {
      const commission = Math.floor((payout * cfg.commission) / 100);
      if (commission > 0) {
        await supabase.rpc("atomic_add_points", {
          target_user_id: ref.referrer_id,
          amount_to_add: commission
        });

        await supabase.from("movements").insert({
          user_id: ref.referrer_id,
          type: "comision_afiliado",
          points: commission,
          reference: userId,
          metadata: { source: "faucet", referred_user: userId },
        });
      }
    }
  }

  // Update last_ip and Level stats
  const ip = await getRequestIp();
  await supabase.rpc("update_faucet_stats", {
    p_user_id: userId,
    p_current_streak: dailyStreak
  });

  await supabase
    .from("profiles")
    .update({ last_ip: ip })
    .eq("id", userId);

  const { checkAndNotifyLevelUp } = await import("@/lib/levels");
  await checkAndNotifyLevelUp(supabase, userId, currentUser.email, currentUser.name);

  return NextResponse.json({
    ok: true,
    points: payout,
    totalPoints: newPoints,
    nextClaimIn: cfg.cooldown * 3600,
    pointsPerBolis: POINTS_PER_BOLIS,
    hourlyStreak,
    dailyStreak,
    hourlyMultiplier,
    dailyBonus,
    basePoints: cfg.base,
  });
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ points: 0, nextClaimIn: null });

  const supabase = await createClient();
  const cfg = await getConfig();

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("email_verified_at")
    .eq("id", userId)
    .single();
  const emailVerified = !!userProfile?.email_verified_at;

  const { data: balance } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", userId)
    .single();

  const { data: claim } = await supabase
    .from("faucet_claims")
    .select("last_claim_at, hourly_streak, daily_streak, last_streak_date, claims_since_captcha")
    .eq("user_id", userId)
    .single();

  const last = claim?.last_claim_at ? new Date(claim.last_claim_at) : null;
  const cooldownMs = cfg.cooldown * 60 * 60 * 1000;
  let nextClaimIn: number | null = null;
  if (last) {
    const elapsed = Date.now() - last.getTime();
    if (elapsed < cooldownMs) nextClaimIn = Math.ceil((cooldownMs - elapsed) / 1000);
  }

  let hourlyStreak = claim?.hourly_streak ?? 0;
  let dailyStreak = claim?.daily_streak ?? 0;
  if (isHourlyStreakBroken(last, cooldownMs)) hourlyStreak = 0;
  if (isDailyStreakBroken(claim?.last_streak_date ?? null)) dailyStreak = 0;

  const preview = calculatePayout(
    cfg.base,
    Math.max(hourlyStreak + 1, 1),
    Math.max(dailyStreak, 1),
    cfg.hourlyTiers,
    cfg.dailyTiers
  );

  const needsCaptcha = (claim?.claims_since_captcha ?? 0) >= cfg.captchaEvery;

  // Check if next claim will require engagement
  const nextClaimNum = hourlyStreak + 1;
  let needsEngagement = false;
  if (nextClaimNum > 1 && nextClaimNum % cfg.engagementEvery === 0) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentBets } = await supabase
      .from("movements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "apuesta_hi_lo")
      .gte("created_at", yesterday);
    needsEngagement = (recentBets ?? 0) < 1;
  }

  return NextResponse.json({
    points: Number(balance?.points ?? 0),
    nextClaimIn,
    faucetPoints: cfg.base,
    cooldownHours: cfg.cooldown,
    pointsPerBolis: POINTS_PER_BOLIS,
    hourlyStreak,
    dailyStreak,
    nextPayout: preview.payout,
    hourlyMultiplier: preview.hourlyMultiplier,
    dailyBonus: preview.dailyBonus,
    needsCaptcha,
    captchaInterval: cfg.captchaEvery,
    claimsSinceCaptcha: claim?.claims_since_captcha ?? 0,
    needsEngagement,
    engagementEvery: cfg.engagementEvery,
    emailVerified,
  });
}
