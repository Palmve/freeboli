import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("movements")
    .select("id, type, points, reference, created_at")
    .eq("user_id", userId)
    .in("type", ["deposito_bolis", "retiro_bolis"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    movements: data ?? [],
  });
}
