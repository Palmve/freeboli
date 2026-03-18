import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("reward_templates")
    .select("id, code, name, description, points_reward")
    .order("created_at", { ascending: true });

  return NextResponse.json({ templates: data ?? [] });
}

export async function PUT(request: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { updates } = await request.json().catch(() => ({ updates: [] }));
  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const supabase = await createClient();
  const errors: string[] = [];

  for (const u of updates) {
    if (!u.id || u.points_reward == null) continue;
    const { error } = await supabase
      .from("reward_templates")
      .update({ points_reward: Number(u.points_reward) })
      .eq("id", u.id);
    if (error) errors.push(`${u.id}: ${error.message}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
