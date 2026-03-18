import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(currentUser.status)) {
    return NextResponse.json({ error: "Tu cuenta está suspendida o bloqueada." }, { status: 403 });
  }
  const userId = currentUser.id;

  const { allowed, retryAfterSeconds } = rateLimit(`withdraw:${userId}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes de retiro. Espera ${Math.ceil(retryAfterSeconds / 60)} minuto(s).` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const points = Number(body.points);
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  if (!Number.isInteger(points) || points < MIN_WITHDRAW_POINTS || !wallet || wallet.length < 32) {
    return NextResponse.json(
      { error: `Mínimo ${MIN_WITHDRAW_POINTS.toLocaleString()} puntos y wallet válida.` },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: balance } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", userId)
    .single();
  const current = Number(balance?.points ?? 0);
  if (current < points) {
    return NextResponse.json(
      { error: "Saldo insuficiente." },
      { status: 400 }
    );
  }

  const { data: inserted, error } = await supabase
    .from("withdrawals")
    .insert({
      user_id: userId,
      points,
      wallet_destination: wallet,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al crear retiro." }, { status: 500 });
  }

  await supabase.from("balances").update({
    points: current - points,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  await supabase.from("movements").insert({
    user_id: userId,
    type: "retiro_bolis",
    points: -points,
    reference: inserted.id,
    metadata: { wallet_destination: wallet, status: "pending" },
  });

  return NextResponse.json({
    ok: true,
    withdrawalId: inserted.id,
    balance: current - points,
  });
}
