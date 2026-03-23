import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json([], { status: 200 });
  const supabase = await createClient();
  const { data } = await supabase
    .from("withdrawals")
    .select("id, user_id, points, wallet_destination, status, created_at, tx_signature, processed_at, profiles(public_id)")
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json(data ?? []);
}
