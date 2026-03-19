import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEmailVerificationToken, hashToken, verifyEmailVerificationToken } from "@/lib/email-verification";
import { sendEmailViaResend } from "@/lib/resend";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIpHash } from "@/lib/ip";

function getAppOrigin(req: Request): string {
  const env = process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const emailRaw = typeof body.email === "string" ? body.email : "";
  const email = emailRaw.toLowerCase().trim();

  const ipHash = await getRequestIpHash();
  // Anti-abuso: limita solicitudes de "forgot password" por IP.
  // - ráfaga: 5 solicitudes / 15 min
  // - diario: 20 solicitudes / 24 h
  const burst = rateLimit(`forgot:${ipHash}`, 5, 15 * 60 * 1000);
  if (!burst.allowed) return NextResponse.json({ ok: true }, { status: 429 });

  const daily = rateLimit(`forgot-day:${ipHash}`, 20, 24 * 60 * 60 * 1000);
  if (!daily.allowed) return NextResponse.json({ ok: true }, { status: 429 });

  // Always respond ok to prevent user enumeration
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  // Anti-abuso adicional: limitar por email (evita spam contra una cuenta)
  const byEmail = rateLimit(`forgot-email:${email}`, 3, 60 * 60 * 1000); // 3 por hora
  if (!byEmail.allowed) return NextResponse.json({ ok: true }, { status: 429 });

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .single();

  if (!profile?.id) {
    return NextResponse.json({ ok: true });
  }

  // Reuse the existing token machinery (HMAC+exp) for password reset.
  const ttlMinutes = 60;
  // Pequeña variación para evitar colisiones si se piden resets en el mismo milisegundo.
  const exp = Date.now() + ttlMinutes * 60_000 + Math.floor(Math.random() * 1000);
  const token = createEmailVerificationToken({ userId: profile.id, email: profile.email ?? email, exp });
  const tokenHash = hashToken(token);

  await supabase.from("password_resets").insert({
    user_id: profile.id,
    token_hash: tokenHash,
    expires_at: new Date(exp).toISOString(),
  });

  const origin = getAppOrigin(req);
  const resetUrl = `${origin}/auth/reset-password?token=${encodeURIComponent(token)}`;

  await sendEmailViaResend({
    to: email,
    subject: "Restablece tu contraseña en FreeBoli",
    html: `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;">
        <h2>Restablecer contraseña</h2>
        <p>Haz clic en el siguiente botón para crear una nueva contraseña.</p>
        <p style="margin: 20px 0;">
          <a href="${resetUrl}" style="background:#f59e0b;color:#0b1220;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:700;">
            Restablecer contraseña
          </a>
        </p>
        <p style="color:#64748b;font-size:12px;">El enlace expira en ${ttlMinutes} minutos. Si no solicitaste esto, puedes ignorar este correo.</p>
      </div>
    `,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

