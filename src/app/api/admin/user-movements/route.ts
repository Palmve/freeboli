import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId requerido." }, { status: 400 });
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

  return NextResponse.json({ movements: data ?? [] });
}
