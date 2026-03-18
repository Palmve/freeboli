import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const ok = await sendTelegramMessage(
    "✅ *Test de conexion exitoso*\nEl bot de monitoreo esta funcionando correctamente.\nFecha: " +
      new Date().toLocaleString("es-ES", { timeZone: "America/Caracas" }),
    "info"
  );

  if (!ok) {
    return NextResponse.json(
      { error: "No se pudo enviar el mensaje. Verifica TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en las variables de entorno." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
