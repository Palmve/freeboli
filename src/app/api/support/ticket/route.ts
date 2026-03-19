import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getAllSettings } from "@/lib/site-settings";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => ({}));
  const { type, subject, message, email } = body;

  if (!type || !subject || !message) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const supabase = await createClient();
  const settings = await getAllSettings();

  // 1. Guardar en Base de Datos
  const { data: ticket, error: dbError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user?.id || null,
      user_email: email || user?.email || "Anónimo",
      type,
      subject,
      message,
      status: "open"
    })
    .select()
    .single();

  if (dbError) {
    console.error("Error al guardar ticket:", dbError);
    return NextResponse.json({ error: "Error al procesar la reclamación" }, { status: 500 });
  }

  // 2. Enviar a Telegram
  const botToken = settings.TELEGRAM_BOT_TOKEN;
  const chatId = settings.TELEGRAM_CHAT_ID;

  if (botToken && chatId) {
    const telegramMessage = `
🚨 *NUEVO RECLAMO / ERROR*
--------------------------
*ID:* \`${ticket.id}\`
*Usuario:* ${ticket.user_email}
*Tipo:* ${type.toUpperCase()}
*Asunto:* ${subject}

*Mensaje:*
${message}

--------------------------
_Enviado desde FreeBoli Support System_
    `;

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: telegramMessage,
          parse_mode: "Markdown"
        })
      });
    } catch (tgError) {
      console.error("Error al enviar telegram:", tgError);
      // No fallamos el request si Telegram falla, el ticket ya está en DB
    }
  }

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
