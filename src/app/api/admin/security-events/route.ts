import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/lib/current-user";

/**
 * GET /api/admin/security-events
 * Devuelve los últimos 100 eventos de seguridad para el panel admin.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: events, error } = await supabase
    .from("security_events")
    .select("id, event_type, user_id, ip_hash, details, severity, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    // Si la tabla no existe aún (migración pendiente), devolvemos vacío
    return NextResponse.json({ events: [] });
  }

  return NextResponse.json({ events: events ?? [] });
}
