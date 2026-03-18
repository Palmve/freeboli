import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";
import { sendBolisToWallet } from "@/lib/solana";
import { POINTS_PER_BOLIS } from "@/lib/config";

export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const withdrawalId = typeof body.withdrawalId === "string" ? body.withdrawalId : "";
  if (!withdrawalId) {
    return NextResponse.json({ error: "withdrawalId requerido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: w, error: fetchErr } = await supabase
    .from("withdrawals")
    .select("id, user_id, points, wallet_destination, status")
    .eq("id", withdrawalId)
    .single();

  if (fetchErr || !w || w.status !== "pending") {
    return NextResponse.json(
      { error: "Retiro no encontrado o ya procesado." },
      { status: 400 }
    );
  }

  const amountBolis = Number(w.points) / POINTS_PER_BOLIS;
  const sig = await sendBolisToWallet(w.wallet_destination, amountBolis);
  if (!sig) {
    return NextResponse.json(
      { error: "Error al enviar BOLIS (revisa wallet y saldo)." },
      { status: 500 }
    );
  }

  await supabase
    .from("withdrawals")
    .update({
      status: "completed",
      tx_signature: sig,
      processed_at: new Date().toISOString(),
    })
    .eq("id", withdrawalId);

  return NextResponse.json({ ok: true, txSignature: sig });
}
