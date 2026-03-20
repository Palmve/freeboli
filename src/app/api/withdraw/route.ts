import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { alertWithdrawalRequest } from "@/lib/telegram";
import { getSetting } from "@/lib/site-settings";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(currentUser.status)) {
    return NextResponse.json({ error: "Tu cuenta está suspendida o bloqueada." }, { status: 403 });
  }
  const userId = currentUser.id;

  const withdrawRateMax = await getSetting<number>("WITHDRAW_RATE_MAX", 5);
  const withdrawWindowHours = await getSetting<number>("WITHDRAW_RATE_WINDOW_HOURS", 1);
  const windowMs = withdrawWindowHours * 60 * 60 * 1000;
  const { allowed, retryAfterSeconds } = rateLimit(`withdraw:${userId}`, withdrawRateMax, windowMs);
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

  // 1. Ejecutar solicitud de retiro de forma atómica (Evita Race Condition)
  const { data: withdrawData, error: withdrawError } = await supabase.rpc("create_withdrawal_request", {
    target_user_id: userId,
    amount_points: points,
    dest_wallet: wallet
  });

  if (withdrawError || !withdrawData?.[0]?.success) {
    return NextResponse.json({ 
        error: withdrawError?.message || "Saldo insuficiente o error al procesar el retiro." 
    }, { status: 400 });
  }

  const withdrawalId = withdrawData[0].withdrawal_id;
  const newBalance = Number(withdrawData[0].result_balance);

  // 2. Registrar el movimiento para el historial
  await supabase.from("movements").insert({
    user_id: userId,
    type: "retiro_bolis",
    points: -points,
    reference: withdrawalId,
    metadata: { wallet_destination: wallet, status: "pending" },
  });

  const autoWithdraw = await getSetting<boolean>("WITHDRAWAL_AUTO_APPROVE", false);
  let txHash = null;

  if (autoWithdraw) {
      try {
          const { sendBolisToUser } = await import("@/lib/solana-payments");
          txHash = await sendBolisToUser(wallet, points);
          
          // Actualizar estado a completado si fue exitoso
          await supabase.from("withdrawals")
            .update({ status: "completed", processed_at: new Date().toISOString(), tx_hash: txHash })
            .eq("id", withdrawalId);
      } catch (err: any) {
          console.error("[AutoWithdraw] Error:", err.message);
          // Si falla el auto-envío, queda como pending para revisión manual
      }
  }

  await alertWithdrawalRequest(currentUser.email, points, wallet);

  return NextResponse.json({
    ok: true,
    withdrawalId: withdrawalId,
    balance: newBalance,
  });
}
