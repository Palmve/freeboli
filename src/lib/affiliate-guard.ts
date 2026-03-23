/**
 * Anti-fraude para comisiones de referidos.
 * Limita cuántos puntos puede recibir un usuario por comisiones de afiliado en 24 horas.
 * Esto evita el farming entre cuentas propias (Sybil attack via referidos).
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { getSetting } from "@/lib/site-settings";
import { logSecurityEvent } from "@/lib/security";

/** Tope diario por defecto: 5,000 puntos en comisiones de referidos */
const DEFAULT_MAX_DAILY_AFFILIATE_COMMISSION = 5000;

/**
 * Verifica si un usuario ya superó su tope de comisiones diarias por referidos.
 * @returns { allowed: boolean, todayTotal: number, max: number }
 */
export async function checkAffiliateCommissionCap(
  supabase: SupabaseClient,
  referrerId: string
): Promise<{ allowed: boolean; todayTotal: number; max: number }> {
  const maxDaily = await getSetting<number>(
    "MAX_DAILY_AFFILIATE_COMMISSION",
    DEFAULT_MAX_DAILY_AFFILIATE_COMMISSION
  );

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: todayCommissions } = await supabase
    .from("movements")
    .select("points")
    .eq("user_id", referrerId)
    .eq("type", "comision_afiliado")
    .gte("created_at", startOfDay.toISOString());

  const todayTotal = (todayCommissions ?? []).reduce(
    (sum, m) => sum + Math.abs(Number(m.points)),
    0
  );

  if (todayTotal >= maxDaily) {
    // Registrar intento de exceder el tope
    await logSecurityEvent({
      eventType: "affiliate_commission_cap_reached",
      userId: referrerId,
      details: { todayTotal, maxDaily },
      severity: "medium",
    });
    return { allowed: false, todayTotal, max: maxDaily };
  }

  return { allowed: true, todayTotal, max: maxDaily };
}

/**
 * Verifica si referrer y referred comparten la misma IP de registro.
 * Esto detecta cuentas Sybil creadas por el mismo usuario.
 * @returns true si comparten IP (sospechoso)
 */
export async function checkSameIPReferral(
  supabase: SupabaseClient,
  referrerId: string,
  referredId: string
): Promise<boolean> {
  const { data: referrerProfile } = await supabase
    .from("profiles")
    .select("registration_ip")
    .eq("id", referrerId)
    .single();

  const { data: referredProfile } = await supabase
    .from("profiles")
    .select("registration_ip")
    .eq("id", referredId)
    .single();

  if (
    referrerProfile?.registration_ip &&
    referredProfile?.registration_ip &&
    referrerProfile.registration_ip === referredProfile.registration_ip
  ) {
    await logSecurityEvent({
      eventType: "sybil_same_ip_referral",
      userId: referrerId,
      details: {
        referredId,
        note: "Referrer y referred registrados desde la misma IP",
      },
      severity: "high",
    });
    return true; // Sospechoso
  }

  return false;
}
