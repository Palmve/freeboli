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
 * Reduce una IP a su "red" para detectar rotación perezosa dentro de la misma
 * subred (CGNAT casero, VPN que reusa rango, móvil del mismo operador):
 *  - IPv4 → /24 (primeros 3 octetos): "203.0.113.x" → "203.0.113"
 *  - IPv6 → /64 aprox (primeros 4 grupos)
 * Devuelve null si no se puede parsear.
 */
function ipNetwork(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}`;
  if (ip.includes(":")) {
    const groups = ip.split(":").filter(Boolean);
    if (groups.length >= 4) return groups.slice(0, 4).join(":");
  }
  return null;
}

/**
 * Verifica si referrer y referred comparten IP. Endurecido (M4): ya no se mira
 * solo la IP de registro EXACTA — esa señal es trivial de esquivar rotando IP.
 * Ahora se cruzan {registration_ip, last_ip} de ambos y se detecta:
 *  - coincidencia EXACTA de cualquier par de IPs (señal fuerte → high)
 *  - misma SUBRED /24 (IPv4) o /64 (IPv6) (señal media → medium; pilla rotación
 *    perezosa, con algún falso positivo en redes compartidas — solo bloquea el
 *    bono, no la cuenta)
 * @returns true si hay señal de autorreferencia (sospechoso)
 */
export async function checkSameIPReferral(
  supabase: SupabaseClient,
  referrerId: string,
  referredId: string
): Promise<boolean> {
  const { data: referrerProfile } = await supabase
    .from("profiles")
    .select("registration_ip, last_ip")
    .eq("id", referrerId)
    .single();

  const { data: referredProfile } = await supabase
    .from("profiles")
    .select("registration_ip, last_ip")
    .eq("id", referredId)
    .single();

  const referrerIps = [referrerProfile?.registration_ip, referrerProfile?.last_ip].filter(Boolean) as string[];
  const referredIps = [referredProfile?.registration_ip, referredProfile?.last_ip].filter(Boolean) as string[];

  // 1. Coincidencia exacta de cualquier par (registro o última IP).
  for (const a of referrerIps) {
    if (referredIps.includes(a)) {
      await logSecurityEvent({
        eventType: "sybil_same_ip_referral",
        userId: referrerId,
        details: { referredId, matchType: "exact_ip", ip: a },
        severity: "high",
      });
      return true;
    }
  }

  // 2. Misma subred (rotación perezosa dentro del mismo rango).
  const referrerNets = referrerIps.map(ipNetwork).filter(Boolean) as string[];
  const referredNets = referredIps.map(ipNetwork).filter(Boolean) as string[];
  for (const net of referrerNets) {
    if (referredNets.includes(net)) {
      await logSecurityEvent({
        eventType: "sybil_same_subnet_referral",
        userId: referrerId,
        details: { referredId, matchType: "same_subnet", subnet: net },
        severity: "medium",
      });
      return true;
    }
  }

  return false;
}
