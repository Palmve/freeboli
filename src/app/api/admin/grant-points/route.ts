import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";
import { logSecurityEvent } from "@/lib/security";

export async function POST(req: Request) {
  // Requiere permiso "finances" — staff sin este permiso no puede otorgar puntos
  const user = await getAdminUser("finances");
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const points = Math.floor(Number(body.points));

  if (!email || points < 1) {
    return NextResponse.json(
      { error: "Indica email del usuario y puntos a otorgar (número positivo)." },
      { status: 400 }
    );
  }

  // Tope de seguridad: máximo 50,000 puntos por operación
  if (points > 50000) {
    return NextResponse.json(
      { error: "El máximo por operación es 50,000 puntos." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Usuario no encontrado con ese email." }, { status: 404 });
  }

  // Usar RPC atómica en vez de read-then-write (previene race condition)
  const { error: rpcError } = await supabase.rpc("atomic_add_points", {
    target_user_id: profile.id,
    amount_to_add: points,
  });

  if (rpcError) {
    return NextResponse.json({ error: `Error al otorgar puntos: ${rpcError.message}` }, { status: 500 });
  }

  // Obtener balance actualizado
  const { data: balance } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", profile.id)
    .single();

  const newTotal = Number(balance?.points ?? 0);

  // Registrar movimiento
  await supabase.from("movements").insert({
    user_id: profile.id,
    type: "ajuste_admin",
    points,
    reference: null,
    metadata: { granted_by: user.id, granted_by_email: user.email, reason: body.reason || "Otorgado por admin" },
  });

  // Audit log
  await logSecurityEvent({
    eventType: "admin_grant_points",
    userId: user.id,
    details: { target_email: email, target_id: profile.id, points, reason: body.reason || "Sin razón" },
    severity: "medium",
  }).catch(console.error);

  return NextResponse.json({
    ok: true,
    email,
    pointsGranted: points,
    newBalance: newTotal,
  });
}
