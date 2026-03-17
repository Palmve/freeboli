import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/current-user";
import { getRequestIpHash } from "@/lib/ip";
import {
  FAUCET_POINTS,
  FAUCET_COOLDOWN_HOURS,
  MAX_SESSIONS_PER_IP,
  POINTS_PER_BOLIS,
  AFFILIATE_COMMISSION_PERCENT,
} from "@/lib/config";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = await createClient();
  const ipHash = await getRequestIpHash();

  // Límite de sesiones por IP: contar cuántos usuarios distintos tienen esta IP
  const { data: sessionIps } = await supabase
    .from("session_ips")
    .select("user_id")
    .eq("ip_hash", ipHash);
  const uniqueUsers = new Set(sessionIps?.map((s) => s.user_id) ?? []);
  if (!uniqueUsers.has(userId)) {
    if (uniqueUsers.size >= MAX_SESSIONS_PER_IP) {
      return NextResponse.json(
        { error: "Límite de conexiones por IP alcanzado. Intenta más tarde." },
        { status: 429 }
      );
    }
    await supabase.from("session_ips").upsert(
      {
        user_id: userId,
        ip_hash: ipHash,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "user_id,ip_hash" }
    );
  } else {
    await supabase
      .from("session_ips")
      .update({ last_seen: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("ip_hash", ipHash);
  }

  const { data: claim } = await supabase
    .from("faucet_claims")
    .select("last_claim_at")
    .eq("user_id", userId)
    .single();

  const now = new Date();
  const last = claim?.last_claim_at ? new Date(claim.last_claim_at) : null;
  const cooldownMs = FAUCET_COOLDOWN_HOURS * 60 * 60 * 1000;
  if (last && now.getTime() - last.getTime() < cooldownMs) {
    const wait = Math.ceil((cooldownMs - (now.getTime() - last.getTime())) / 1000);
    return NextResponse.json(
      { error: "Espera antes de reclamar de nuevo.", waitSeconds: wait },
      { status: 429 }
    );
  }

  const { data: balanceRow } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", userId)
    .single();

  const newPoints = Number(balanceRow?.points ?? 0) + FAUCET_POINTS;

  await supabase.from("balances").upsert(
    { user_id: userId, points: newPoints, updated_at: now.toISOString() },
    { onConflict: "user_id" }
  );
  await supabase.from("movements").insert({
    user_id: userId,
    type: "faucet",
    points: FAUCET_POINTS,
    reference: null,
  });
  await supabase.from("faucet_claims").upsert(
    { user_id: userId, last_claim_at: now.toISOString() },
    { onConflict: "user_id" }
  );

  const { data: ref } = await supabase
    .from("referrals")
    .select("referrer_id")
    .eq("referred_id", userId)
    .single();
  if (ref?.referrer_id && AFFILIATE_COMMISSION_PERCENT > 0) {
    const commission = Math.floor((FAUCET_POINTS * AFFILIATE_COMMISSION_PERCENT) / 100);
    if (commission > 0) {
      const { data: refBalance } = await supabase
        .from("balances")
        .select("points")
        .eq("user_id", ref.referrer_id)
        .single();
      const refNewPoints = Number(refBalance?.points ?? 0) + commission;
      await supabase.from("balances").upsert(
        { user_id: ref.referrer_id, points: refNewPoints, updated_at: now.toISOString() },
        { onConflict: "user_id" }
      );
      await supabase.from("movements").insert({
        user_id: ref.referrer_id,
        type: "comision_afiliado",
        points: commission,
        reference: userId,
        metadata: { source: "faucet", referred_user: userId },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    points: FAUCET_POINTS,
    totalPoints: newPoints,
    nextClaimIn: FAUCET_COOLDOWN_HOURS * 3600,
    pointsPerBolis: POINTS_PER_BOLIS,
  });
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ points: 0, nextClaimIn: null }, { status: 200 });

  const supabase = await createClient();
  const { data: balance } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", userId)
    .single();
  const { data: claim } = await supabase
    .from("faucet_claims")
    .select("last_claim_at")
    .eq("user_id", userId)
    .single();

  const last = claim?.last_claim_at ? new Date(claim.last_claim_at) : null;
  const cooldownMs = FAUCET_COOLDOWN_HOURS * 60 * 60 * 1000;
  let nextClaimIn: number | null = null;
  if (last) {
    const elapsed = Date.now() - last.getTime();
    if (elapsed < cooldownMs) nextClaimIn = Math.ceil((cooldownMs - elapsed) / 1000);
  }

  return NextResponse.json({
    points: Number(balance?.points ?? 0),
    nextClaimIn,
    faucetPoints: FAUCET_POINTS,
    cooldownHours: FAUCET_COOLDOWN_HOURS,
    pointsPerBolis: POINTS_PER_BOLIS,
  });
}
