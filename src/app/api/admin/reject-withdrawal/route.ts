import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";

export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const withdrawalId = typeof body.withdrawalId === "string" ? body.withdrawalId : "";
  if (!withdrawalId) {
    return NextResponse.json({ error: "withdrawalId requerido." }, { status: 400 });
  }

  const supabase = await createClient();
  
  // 1. Obtener los datos del retiro
  const { data: w, error: fetchErr } = await supabase
    .from("withdrawals")
    .select("id, user_id, points, status")
    .eq("id", withdrawalId)
    .single();

  if (fetchErr || !w || w.status !== "pending") {
    return NextResponse.json(
      { error: "Retiro no encontrado o ya procesado." },
      { status: 400 }
    );
  }

  // 2. Actualizar el estado del retiro a 'rejected'
  const { error: updError } = await supabase
    .from("withdrawals")
    .update({
      status: "rejected",
      processed_at: new Date().toISOString(),
    })
    .eq("id", withdrawalId);

  if (updError) {
      console.error("Error al rechazar retiro:", updError.message);
      return NextResponse.json({ error: "Error al actualizar el retiro." }, { status: 500 });
  }

  // 3. Devolver los puntos al usuario
  // Buscamos el balance actual
  const { data: bal } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", w.user_id)
    .single();
  
  const currentPoints = Number(bal?.points ?? 0);
  const pointsToReturn = Number(w.points);
  const newBalance = currentPoints + pointsToReturn;

  const { error: balError } = await supabase
    .from("balances")
    .upsert({ 
        user_id: w.user_id, 
        points: newBalance,
        updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

  if (balError) {
      console.error("Error al devolver puntos:", balError.message);
  }

  // 4. Crear movimiento de compensación
  await supabase.from("movements").insert({
    user_id: w.user_id,
    type: "retiro_rechazado",
    points: pointsToReturn,
    reference: withdrawalId,
    metadata: { status: "rejected", reason: "Rechazado por administrador" },
  });

  return NextResponse.json({ ok: true, newBalance });
}
