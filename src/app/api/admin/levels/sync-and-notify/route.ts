import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";
import { fetchUserLevel } from "@/lib/levels";
import { sendEmailViaResend } from "@/lib/resend";
import { getNewLevelsConfigEmail, getUserStatusEmail } from "@/lib/mail-templates";

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, name, hilo_bet_count, faucet_claim_count, prediction_count, max_daily_streak, email_verified_at");

  if (error || !profiles) {
    return NextResponse.json({ error: "Error al obtener perfiles." }, { status: 500 });
  }

  console.log(`[LevelSync] Iniciando envío masivo para ${profiles.length} usuarios...`);

  let sentCount = 0;
  let errorCount = 0;

  // Template base para el anuncio general
  const announceHtml = getNewLevelsConfigEmail();

  for (const p of profiles) {
    if (!p.email) continue;

    try {
      // 1. Calcular nivel actual con la nueva lógica
      const levels = await import("@/lib/levels");
      const currentLevel = levels.getUserLevel({
        betCount: p.hilo_bet_count ?? 0,
        faucetClaims: p.faucet_claim_count ?? 0,
        predictionCount: p.prediction_count ?? 0,
        maxConsecutiveDays: p.max_daily_streak ?? 0,
        referralCount: 0, // No necesitamos referidos exactos para el resumen básico aquí si queremos rapidez
        emailVerified: !!p.email_verified_at
      });

      // 2. Enviar anuncio de nueva configuración
      const baseOk = await sendEmailViaResend({
        to: p.email,
        subject: "🚀 Actualización importante: Nuevo sistema de Niveles en FreeBoli",
        html: announceHtml
      });

      // 3. Enviar estatus personal (opcionalmente juntos o separado, aquí separado para claridad)
      if (baseOk) {
          await sendEmailViaResend({
            to: p.email,
            subject: `📊 Tu Estatus Actual: Nivel ${currentLevel.name}`,
            html: getUserStatusEmail(p.name || p.email.split('@')[0], currentLevel.name, p)
          });
          
          // Actualizar last_notified_level para que el sistema automático sepa en qué nivel se quedó
          await supabase.from("profiles").update({ last_notified_level: currentLevel.level }).eq("id", p.id);
          
          sentCount++;
      } else {
          errorCount++;
      }

      // Pequeño delay para no saturar Resend (100ms entre usuarios)
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      console.error(`[LevelSync] Error con usuario ${p.email}:`, err);
      errorCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    total: profiles.length,
    sent: sentCount,
    errors: errorCount
  });
}
