import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { createClient } from "@supabase/supabase-js";
import { sendEmailViaResendDetailed } from "@/lib/resend";
import crypto from "crypto";

export async function POST() {
  const user = await getAdminUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Servidor sin configuración de base de datos." }, { status: 503 });
  }

  const pin = Array.from({ length: 6 }, () => crypto.randomInt(0, 10)).join("");
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const tokenHash = crypto.createHash("sha256").update(pin).digest("hex");

  const supabase = createClient(url, serviceKey);

  await supabase.from("email_verifications").delete().eq("user_id", user.id);

  const { error: dbError } = await supabase.from("email_verifications").insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expires,
  });

  if (dbError) {
    console.error("[device-auth/request] DB:", dbError.message);
    return NextResponse.json({ error: "Error al guardar el código. Revisa la tabla email_verifications." }, { status: 500 });
  }

  const htmlTemplate = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4; border-radius: 8px;">
      <h2 style="color: #f59e0b;">🛡️ FreeBoli: Autorización de Dispositivo Nuevo</h2>
      <p style="color: #333;">Hola Administrador,</p>
      <p style="color: #333;">Hemos detectado un intento de inicio de sesión administrativo desde un dispositivo o navegador no reconocido.</p>
      <p style="color: #333;">Para autorizar este dispositivo y conceder acceso al Panel de Control de FreeBoli, utiliza el siguiente código PIN de un solo uso (OTP):</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #1e293b; color: #facc15; padding: 10px 30px; border-radius: 8px; border: 1px solid #334155;">
          ${pin}
        </span>
      </div>

      <p style="color: #666; font-size: 13px;">Este código expirará en 15 minutos.</p>
      <p style="color: #ef4444; font-size: 13px; font-weight: bold;">⚠️ Si tú no solicitaste este acceso, alguien podría tener acceso a tu cuenta. Cambia la contraseña y revisa la actividad.</p>
      
      <p style="color: #333; margin-top: 30px;">Atentamente,<br><strong>FreeBoli Security</strong></p>
    </div>
  `;

  if (process.env.NODE_ENV === "development") {
    console.log("------------------------------------------");
    console.log("🔐 [DEV] PIN dispositivo admin:", pin, "→", user.email);
    console.log("------------------------------------------");
  }

  const emailResult = await sendEmailViaResendDetailed({
    to: user.email,
    subject: "Autorización de Dispositivo Administrativo - FreeBoli",
    html: htmlTemplate,
  });

  if (!emailResult.ok) {
    console.error("[device-auth/request] Resend:", emailResult.error, emailResult.status ?? "");
    return NextResponse.json(
      {
        error: emailResult.error,
        hint:
          "Comprueba en Vercel (o .env) RESEND_API_KEY y RESEND_FROM. El remitente debe ser un dominio verificado en resend.com. Revisa también spam y promociones.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, message: "PIN generado correctamente." });
}
