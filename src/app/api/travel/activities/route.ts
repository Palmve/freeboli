import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TRAVEL_CODE = "a8107474";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (code !== TRAVEL_CODE) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("travel_activities")
    .select("*")
    .order("day_number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { code, activity } = body;

  if (code !== TRAVEL_CODE) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!activity || !activity.id) {
    return NextResponse.json({ error: "Faltan datos de actividad" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("travel_activities")
    .upsert({
      ...activity,
      updated_at: new Date().toISOString()
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
