import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/current-user";
import {
  getTreasuryPublicKey,
  verifyIncomingBolisTransfer,
  bolisToPoints,
} from "@/lib/solana";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const txSignature = typeof body.txSignature === "string" ? body.txSignature.trim() : "";
  if (!txSignature) {
    return NextResponse.json({ error: "Firma de transacción requerida." }, { status: 400 });
  }

  const treasuryAddress = getTreasuryPublicKey();
  if (!treasuryAddress) {
    return NextResponse.json({ error: "Depósitos no configurados." }, { status: 503 });
  }

  const result = await verifyIncomingBolisTransfer(txSignature, treasuryAddress);
  if (!result || result.amount <= 0) {
    return NextResponse.json(
      { error: "Transacción no válida o no encontrada." },
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

  const supabase = await createClient();
  const { data: balance } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", userId)
    .single();
  const newPoints = Number(balance?.points ?? 0) + pointsToAdd;

  await supabase.from("balances").upsert(
    { user_id: userId, points: newPoints, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  await supabase.from("movements").insert({
    user_id: userId,
    type: "deposito_bolis",
    points: pointsToAdd,
    reference: txSignature,
    metadata: { bolisAmount: result.amount },
  });

  return NextResponse.json({
    ok: true,
    pointsAdded: pointsToAdd,
    totalPoints: newPoints,
    bolisAmount: result.amount,
  });
}
