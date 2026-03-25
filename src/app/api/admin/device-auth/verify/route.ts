import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "crypto";
import { persistentRateLimit, logSecurityEvent } from "@/lib/security";

export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Rate limit anti brute-force: máx 5 intentos cada 15 minutos
  const { allowed } = await persistentRateLimit(`pin-verify:${user.id}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    await logSecurityEvent({
      eventType: "admin_pin_brute_force",
      userId: user.id,
      details: { note: "Excedió 5 intentos de PIN en 15 minutos" },
      severity: "critical",
    }).catch(console.error);
    return NextResponse.json(
      { error: "Demasiados intentos. Espera 15 minutos antes de intentar de nuevo." },
      { status: 429 }
    );
  }

  const { pin } = await req.json().catch(() => ({ pin: "" }));
  if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "Formato de PIN inválido (deben ser 6 dígitos)" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Servidor sin configuración de base de datos." }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey);
  const hashedPin = crypto.createHash("sha256").update(pin).digest("hex");
  
  const { data: tokens } = await supabase
    .from("email_verifications")
    .select("token_hash, expires_at")
    .eq("user_id", user.id)
    .eq("token_hash", hashedPin);

  if (!tokens || tokens.length === 0) {
    // Registrar intento fallido
    await logSecurityEvent({
      eventType: "admin_pin_failed",
      userId: user.id,
      details: { note: "PIN incorrecto" },
      severity: "medium",
    }).catch(console.error);
    // Retraso para mitigar fuerza bruta (entre 1 y 2 segundos)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const tokenRecord = tokens[0];
  if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "El PIN ha expirado. Solicita otro." }, { status: 401 });
  }

  // PIN válido. Proceder con el Fingerprinting.
  // 1. Destruimos el PIN para evitar re-usos (Replay Attacks).
  await supabase.from("email_verifications").delete().eq("user_id", user.id);

  // 2. Insertamos la galleta de reconocimiento de dispositivo (30 Días)
  const isProd = process.env.NODE_ENV === "production";
  cookies().set(`freeboli_device_trusted_${user.id.slice(0, 8)}`, "true", {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  // 3. Registrar acceso exitoso
  await logSecurityEvent({
    eventType: "admin_device_authorized",
    userId: user.id,
    details: { note: "Dispositivo autorizado exitosamente" },
    severity: "low",
  }).catch(console.error);

  return NextResponse.json({ success: true, message: "Dispositivo autorizado de forma permanente." });
}
