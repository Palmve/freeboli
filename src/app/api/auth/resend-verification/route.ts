import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { createVerificationRequest } from "@/lib/email-verification";
import { sendEmailViaResend } from "@/lib/resend";

function getAppOrigin(req: Request): string {
  const env = process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, email_verified_at")
    .eq("id", user.id)
    .single();

  const email = (profile?.email || user.email || "").toLowerCase().trim();
  if (!email) return NextResponse.json({ error: "Email no disponible." }, { status: 400 });

  if (profile?.email_verified_at) return NextResponse.json({ ok: true, alreadyVerified: true });

  const { token } = await createVerificationRequest({ userId: user.id, email });
  const origin = getAppOrigin(req);
  const verifyUrl = `${origin}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const ok = await sendEmailViaResend({
    to: email,
    subject: "Verifica tu correo en FreeBoli",
    html: `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;">
        <h2>Verificación de correo</h2>
        <p>Haz clic en el siguiente botón para verificar tu correo y desbloquear el Faucet y recompensas.</p>
        <p style="margin: 20px 0;">
          <a href="${verifyUrl}" style="background:#f59e0b;color:#0b1220;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:700;">
            Verificar correo
          </a>
        </p>
        <p style="color:#64748b;font-size:12px;">Si no solicitaste esto, puedes ignorar este correo.</p>
      </div>
    `,
  });

  if (!ok) {
    return NextResponse.json(
      { error: "No se pudo enviar el correo. Configura RESEND_API_KEY y RESEND_FROM en Vercel." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

