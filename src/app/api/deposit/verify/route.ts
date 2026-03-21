import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUserId } from "@/lib/current-user";
import { verifyIncomingBolisTransfer, bolisToPoints } from "@/lib/solana";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const txSignature = typeof body.txSignature === "string" ? body.txSignature.trim() : "";
  if (!txSignature) {
    return NextResponse.json({ error: "Firma de transacción requerida." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Depósitos no configurados en el servidor." }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey);

  const { data: existingProcessed } = await supabase
    .from("processed_deposits")
    .select("user_id, points_added")
    .eq("tx_signature", txSignature)
    .maybeSingle();

  if (existingProcessed) {
    if (existingProcessed.user_id !== userId) {
      return NextResponse.json(
        { error: "Esta transacción ya fue acreditada." },
        { status: 403 }
      );
    }
    const { data: balance } = await supabase
      .from("balances")
      .select("points")
      .eq("user_id", userId)
      .single();
    return NextResponse.json({
      ok: true,
      alreadyProcessed: true,
      pointsAdded: 0,
      totalPoints: Number(balance?.points ?? 0),
      bolisAmount: null,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("deposit_address")
    .eq("id", userId)
    .single();

  const depositAddress = profile?.deposit_address?.trim();
  if (!depositAddress || depositAddress.length < 32) {
    return NextResponse.json(
      { error: "Dirección de depósito inválida o no generada. Ve a 'Depositar' primero." },
      { status: 400 }
    );
  }

  const result = await verifyIncomingBolisTransfer(txSignature, depositAddress);
  if (!result || result.amount <= 0) {
    return NextResponse.json(
      { error: "Transacción no válida o no encontrada hacia tu dirección de depósito." },
      { status: 400 }
    );
  }

  const pointsToAdd = bolisToPoints(result.amount);
  if (pointsToAdd <= 0) {
    return NextResponse.json(
      { error: "Cantidad de BOLIS insuficiente." },
      { status: 400 }
    );
  }

  const { error: claimErr } = await supabase.from("processed_deposits").insert({
    tx_signature: txSignature,
    user_id: userId,
    amount_bolis: result.amount,
    points_added: pointsToAdd,
  });

  if (claimErr) {
    if (claimErr.code === "23505") {
      return NextResponse.json(
        { error: "Esta transacción ya está siendo procesada o fue acreditada." },
        { status: 409 }
      );
    }
    console.error("[deposit/verify] processed_deposits insert:", claimErr.message);
    return NextResponse.json({ error: "Error al registrar el depósito." }, { status: 500 });
  }

  const { data: addData, error: addError } = await supabase.rpc("atomic_add_points", {
    target_user_id: userId,
    amount_to_add: pointsToAdd,
  });

  if (addError || !addData?.[0]?.success) {
    await supabase.from("processed_deposits").delete().eq("tx_signature", txSignature);
    return NextResponse.json(
      { error: addError?.message || "Error al acreditar puntos. Intenta de nuevo." },
      { status: 500 }
    );
  }

  const newPoints = Number(addData[0].result_balance);

  const { error: movErr } = await supabase.from("movements").insert({
    user_id: userId,
    type: "deposito_bolis",
    points: pointsToAdd,
    reference: txSignature,
    metadata: { bolisAmount: result.amount, source: "manual_verify" },
  });

  if (movErr) {
    console.error("[deposit/verify] movement insert:", movErr.message);
  }

  return NextResponse.json({
    ok: true,
    pointsAdded: pointsToAdd,
    totalPoints: newPoints,
    bolisAmount: result.amount,
  });
}
