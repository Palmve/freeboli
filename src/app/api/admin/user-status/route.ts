import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { alertUserBlocked } from "@/lib/telegram";

const VALID_STATUSES = ["normal", "evaluar", "suspendido", "bloqueado"];

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { userId, status } = body;

  if (!userId || !status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "userId y status válido requeridos." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (status === "suspendido" || status === "bloqueado") {
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
    alertUserBlocked(profile?.email ?? userId, status);
  }

  return NextResponse.json({ ok: true, status });
}
