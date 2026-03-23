import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/lib/current-user";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/security-events
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: events, error } = await supabaseAdmin
    .from("security_events")
    .select("id, event_type, user_id, ip_hash, details, severity, status, created_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ events: [] });
  }

  return NextResponse.json({ events: events ?? [] });
}

/**
 * PATCH /api/admin/security-events
 * Resuelve o descarta un evento de seguridad.
 */
export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { eventId, status, comment } = await req.json().catch(() => ({}));

  if (!eventId || !status) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  // 1. Obtener info del evento para lógica adicional (ej. desbloqueo)
  const { data: eventInfo } = await supabaseAdmin
    .from("security_events")
    .select("event_type, user_id")
    .eq("id", eventId)
    .single();

  // 2. Actualizar el evento
  const { error } = await supabaseAdmin
    .from("security_events")
    .update({
      status,
      resolution_comment: comment || null,
      resolved_by: admin.id,
      resolved_at: new Date().toISOString()
    })
    .eq("id", eventId);

  if (error) {
    console.error("Error updating security event:", error);
    return NextResponse.json({ error: "Error al actualizar evento." }, { status: 500 });
  }

  // 3. Lógica Especial: Si se resuelve un evento de FRECUENCIA SOSPECHOSA,
  // habilitamos bypass de límites por 24 horas para ese usuario automáticamente.
  if (status === "resolved" && eventInfo?.event_type === "suspicious_withdrawal_frequency" && eventInfo.user_id) {
    console.log(`[Security] Resolviendo alerta de frecuencia para ${eventInfo.user_id}. Habilitando bypass 24h.`);
    await supabaseAdmin
      .from("profiles")
      .update({
        withdraw_limit_override_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .eq("id", eventInfo.user_id);
  }

  return NextResponse.json({ ok: true });
}
