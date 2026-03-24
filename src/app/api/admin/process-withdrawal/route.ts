import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";
import { sendBolisToWallet } from "@/lib/solana";
import { POINTS_PER_BOLIS } from "@/lib/config";
import { alertWithdrawalCompleted } from "@/lib/telegram";

export async function POST(req: Request) {
  const user = await getAdminUser("finances");
  if (!user) return NextResponse.json({ error: "No autorizado (falta permiso o dispositivo no verificado)." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const withdrawalId = typeof body.withdrawalId === "string" ? body.withdrawalId : "";
  if (!withdrawalId) {
    return NextResponse.json({ error: "withdrawalId requerido." }, { status: 400 });
  }

  const supabase = await createClient();
  
  // 1. Bloqueo de estado atómico (Evita que dos admins procesen el mismo retiro simultáneamente)
  const { data: w, error: updateErr } = await supabase
    .from("withdrawals")
    .update({ status: "processing" })
    .eq("id", withdrawalId)
    .eq("status", "pending")
    .select("id, user_id, points, wallet_destination")
    .single();

  if (updateErr || !w) {
    return NextResponse.json(
      { error: "La solicitud ya está siendo procesada o no existe." },
      { status: 409 }
    );
  }

  const amountBolis = Number(w.points) / POINTS_PER_BOLIS;
  
  try {
    const sig = await sendBolisToWallet(w.wallet_destination, amountBolis);
    
    if (!sig) {
      // Revertir a pending si falló el oráculo (e.g. sin saldo en master wallet)
      await supabase.from("withdrawals").update({ status: "pending" }).eq("id", withdrawalId);
      return NextResponse.json(
        { error: "Error al enviar BOLIS (revisa wallet y saldo)." },
        { status: 500 }
      );
    }

    // 2. Marcar como completado definitivamente
    await supabase
      .from("withdrawals")
      .update({
        status: "completed",
        tx_signature: sig,
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId);
    
    const { data: u } = await supabase.from("profiles").select("email").eq("id", w.user_id).single();
    await alertWithdrawalCompleted(u?.email ?? String(w.user_id), Number(w.points), sig)
      .catch(e => console.error("Error alert Telegram:", e));

    return NextResponse.json({ ok: true, txSignature: sig });

  } catch (err: any) {
    // Revertir a pending ante error de red o similar
    await supabase.from("withdrawals").update({ status: "pending" }).eq("id", withdrawalId);
    return NextResponse.json({ error: `Excepción en Solana: ${err.message}` }, { status: 500 });
  }
}
