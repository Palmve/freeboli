import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
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
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Usuario no encontrado con ese email." }, { status: 404 });
  }
  const { data: balance } = await supabase
    .from("balances")
    .select("points")
    .eq("user_id", profile.id)
    .single();
  const current = Number(balance?.points ?? 0);
  const newTotal = current + points;
  await supabase
    .from("balances")
    .upsert(
      { user_id: profile.id, points: newTotal, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  await supabase.from("movements").insert({
    user_id: profile.id,
    type: "ajuste_admin",
    points,
    reference: null,
    metadata: { granted_by: user.id, reason: body.reason || "Otorgado por admin" },
  });
  return NextResponse.json({
    ok: true,
    email,
    pointsGranted: points,
    previousBalance: current,
    newBalance: newTotal,
  });
}
