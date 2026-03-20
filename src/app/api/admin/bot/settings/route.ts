import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearSettingsCache } from "@/lib/site-settings";

export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const supabase = createAdminClient();

  // Actualizar settings uno a uno o en masa
  const updates = Object.entries(body).map(([key, value]) => ({
    key,
    value: typeof value === "object" ? JSON.stringify(value) : String(value)
  }));

  for (const item of updates) {
      await supabase.from("site_settings").upsert(item).eq("key", item.key);
  }

  clearSettingsCache();
  return NextResponse.json({ success: true });
}
