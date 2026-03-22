import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { getAllSettings } from "@/lib/site-settings";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

function getIpFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const h = await headers();
  const ip = getIpFromHeaders(h);
  const userKey = user?.id || ip;

  // 0. Rate Limiting (3 tickets por hora)
  const { allowed, retryAfterSeconds } = rateLimit(`support:${userKey}`, 3, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Has enviado demasiados tickets. Por favor, espera ${Math.ceil(retryAfterSeconds / 60)} minuto(s).` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { type, subject, message, email } = body;

  // 1. Validaciones de Presencia y Formato
  if (!type || !subject || !message) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  // Validación de Email (Si no está logueado o proporciona uno)
  const contactEmail = email || user?.email;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!contactEmail || !emailRegex.test(contactEmail)) {
    return NextResponse.json({ error: "Correo electrónico inválido" }, { status: 400 });
  }

  // Validación de Longitud (Anti-DoS / DB Bloat)
  if (subject.length > 100) {
    return NextResponse.json({ error: "El asunto es demasiado largo (máx 100 car.)" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "El mensaje es demasiado largo (máx 2000 car.)" }, { status: 400 });
  }

  const supabase = await createClient();
  const settings = await getAllSettings();

  // 1. Guardar en Base de Datos
  const { data: ticket, error: dbError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user?.id || null,
      user_email: contactEmail,
      type: type.slice(0, 50),
      subject: subject.trim(),
      message: message.trim(),
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
