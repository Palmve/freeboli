import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllSettings } from "@/lib/site-settings";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createAdminClient();
  const [settings, { data: wallets }] = await Promise.all([
    getAllSettings(),
    supabase.from("bot_wallets").select("*").order("created_at", { ascending: false })
  ]);

  return NextResponse.json({ settings, wallets });
}
