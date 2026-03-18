import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";
import { clearSettingsCache, getAllSettings } from "@/lib/site-settings";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const settings = await getAllSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { settings } = body as { settings?: Record<string, unknown> };
  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const supabase = await createClient();
  const errors: string[] = [];

  for (const [key, value] of Object.entries(settings)) {
    const jsonValue = typeof value === "object" ? JSON.stringify(value) : String(value);
    const { error } = await supabase
      .from("site_settings")
      .upsert(
        { key, value: jsonValue, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (error) errors.push(`${key}: ${error.message}`);
  }

  clearSettingsCache();

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
