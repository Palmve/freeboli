import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchActiveLevels, LEVELS } from "@/lib/levels";

/** Lista de niveles con límites y premios efectivos (site_settings.LEVEL_LIMITS). Público. */
export async function GET() {
  try {
    const supabase = await createClient();
    const levels = await fetchActiveLevels(supabase);
    return NextResponse.json({ levels });
  } catch {
    return NextResponse.json({ levels: LEVELS });
  }
}
