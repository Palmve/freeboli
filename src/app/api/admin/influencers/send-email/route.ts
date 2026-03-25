import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { sendEmailViaResend } from "@/lib/resend";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Escapa caracteres HTML para prevenir XSS en templates de email */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: Request) {
  const admin = await getAdminUser("promotions");
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { influencerId, lang: rawLang } = body;

  // Validar UUID estricto
  if (!influencerId || !UUID_RE.test(influencerId)) {
    return NextResponse.json({ error: "influencerId inválido" }, { status: 400 });
  }

  // Validar lang como literal "es" | "en"
  const lang = rawLang === "en" ? "en" : "es";

  const supabase = await createClient();

  // 1. Obtener datos del influencer y su config
  const { data: config } = await supabase
    .from("influencer_configs")
    .select(`*, profiles:user_id(email, name)`)
    .eq("user_id", influencerId)
    .single();

  if (!config) return NextResponse.json({ error: "Influencer no encontrado" }, { status: 404 });

  // 2. Obtener estadísticas (conteo referidos y suma de bonos)
  const { count: referrals } = await supabase.from("referrals").select("*", { count: "exact", head: true }).eq("referrer_id", influencerId);
  
  const { data: bountySum } = await supabase.from("movements").select("points.sum()").eq("user_id", influencerId).eq("type", "influencer_bounty");
  const totalPoints = (bountySum?.[0] as any)?.sum || 0;
  const totalBolis = totalPoints / 1000;

  // 3. Preparar Contenido del Email (nombre sanitizado contra XSS)
  const isEn = lang === "en";
  const subject = isEn ? "Your FreeBoli Promotion Report" : "Tu Reporte de Promoción en FreeBoli";
  const name = escapeHtml(config.profiles.name || "Influencer");
  
  const html = isEn ? `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px;">
      <h2 style="color: #f59e0b;">Hello, ${name}!</h2>
      <p>Here is your current performance report for your FreeBoli promotion:</p>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Total Affiliates:</strong> ${referrals || 0}</p>
        <p><strong>Total Points Earned:</strong> ${totalPoints.toLocaleString()} points</p>
        <p><strong>Total Amount in Bolis:</strong> ${totalBolis.toLocaleString()} Bolis</p>
      </div>
      <p>Keep promoting the site and earning more bolis with every verified registration!</p>
      <p style="margin-top: 30px; font-size: 0.8em; color: #999;">Best regards,<br/>The FreeBoli Team</p>
    </div>
  ` : `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px;">
      <h2 style="color: #f59e0b;">¡Hola, ${name}!</h2>
      <p>Este es tu reporte actual de rendimiento por promocionar FreeBoli:</p>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Afiliados Totales:</strong> ${referrals || 0}</p>
        <p><strong>Puntos Logrados:</strong> ${totalPoints.toLocaleString()} puntos</p>
        <p><strong>Monto Total en Bolis:</strong> ${totalBolis.toLocaleString()} Bolis</p>
      </div>
      <p>¡Sigue promocionando la web e invitando a más personas para ganar más bolis por cada registro verificado!</p>
      <p style="margin-top: 30px; font-size: 0.8em; color: #999;">Saludos,<br/>El Equipo de FreeBoli</p>
    </div>
  `;

  const ok = await sendEmailViaResend({
    to: config.profiles.email,
    subject,
    html
  });

  if (!ok) return NextResponse.json({ error: "Error al enviar el correo" }, { status: 500 });
  
  return NextResponse.json({ success: true });
}
