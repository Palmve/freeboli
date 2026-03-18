import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ accepted: false });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("terms_accepted_at")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ accepted: !!data?.terms_accepted_at });
}
