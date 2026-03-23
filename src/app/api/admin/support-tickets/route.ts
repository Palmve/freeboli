import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";
import { sendEmailViaResend } from "@/lib/resend";
import { getSupportUpdateEmail } from "@/lib/mail-templates";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const supabase = await createClient();
  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }

  return NextResponse.json({ tickets });
}

export async function PATCH(request: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { ticketId, status } = await request.json().catch(() => ({}));

  if (!ticketId || !status) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Obtener datos del ticket para el correo
  const { data: ticket, error: fetchError } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (fetchError || !ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  // 2. Actualizar estado en DB
  // Mapeamos a los estados de la DB o guardamos los nuevos literalmente
  const { error: updateError } = await supabase
    .from("support_tickets")
    .update({ 
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq("id", ticketId);

  if (updateError) {
    return NextResponse.json({ error: "Error al actualizar DB" }, { status: 500 });
  }

  // 3. Enviar correo al usuario
  if (ticket.user_email) {
    const lang = ticket.lang || "es";
    const statusType = status as "approved" | "rejected" | "info_requested";
    
    // Solo enviamos correo si el estado es uno de los tres solicitados
    if (["approved", "rejected", "info_requested"].includes(status)) {
        const html = getSupportUpdateEmail({
          lang,
          status: statusType,
          ticketId: ticket.id,
          subject: ticket.subject
        });

        const subjectMap = {
          approved: lang === "en" ? "FreeBoli Support: Request Approved" : "Soporte FreeBoli: Solicitud Aprobada",
          rejected: lang === "en" ? "FreeBoli Support: Request Rejected" : "Soporte FreeBoli: Solicitud Rechazada",
          info_requested: lang === "en" ? "FreeBoli Support: More Information Needed" : "Soporte FreeBoli: Se requiere más información",
        };

        await sendEmailViaResend({
          to: ticket.user_email,
          subject: `${subjectMap[statusType]} [ID: ${ticket.id.slice(0, 8)}]`,
          html
        });
    }
  }

  return NextResponse.json({ ok: true });
}
