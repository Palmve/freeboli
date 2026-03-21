import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { sendEmailViaResend } from "@/lib/resend";
import crypto from "crypto";

export async function POST() {
  const user = await getAdminUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Generate 6-digit numeric PIN
  const pin = Array.from({ length: 6 }, () => crypto.randomInt(0, 10)).join("");
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const supabase = await createClient();
  
  // Clean old tokens
  await supabase.from("verification_tokens").delete().eq("identifier", user.email);

  // Store new token
  const { error: dbError } = await supabase.from("verification_tokens").insert({
    identifier: user.email,
    token: pin,
    expires: expires
  });

  if (dbError) {
    return NextResponse.json({ error: "Error en base de datos" }, { status: 500 });
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
      <p style="color: #ef4444; font-size: 13px; font-weight: bold;">⚠️ Si tú no solicitaste este acceso, ALGUIEN TIENE TU CONTRASEÑA MUESTRA. Cámbiala inmediatamente o revoca tu sesión.</p>
      
      <p style="color: #333; margin-top: 30px;">Atentamente,<br><strong>FreeBoli Security Subsystem</strong></p>
    </div>
  `;

  const emailSent = await sendEmailViaResend({
    to: user.email,
    subject: "Autorización de Dispositivo Administrativo - FreeBoli",
    html: htmlTemplate
  });

  if (!emailSent) {
    return NextResponse.json({ error: "No se pudo enviar el correo de verificación TCP" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "PIN OTP enviado correctamente al correo." });
}
