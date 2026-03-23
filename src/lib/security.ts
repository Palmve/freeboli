/**
 * Rate-limiting persistente usando Supabase (`rate_limit_log`).
 * A diferencia del rate-limit en memoria, este funciona entre todos
 * los workers de Vercel (serverless), evitando el bypass con múltiples IPs/procesos.
 *
 * USO: Para endpoints críticos como /api/withdraw y /api/faucet.
 * Para endpoints de alta frecuencia usar el in-memory como primera capa.
 */
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Supabase service role not configured");
  return createClient(url, key);
}

export interface PersistentRateLimitResult {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
}

/**
 * Verifica rate-limit usando la base de datos (persistente entre workers).
 * @param key       Clave única, e.g. "withdraw:userId", "faucet:ipHash"
 * @param max       Máximo de peticiones permitidas en la ventana
 * @param windowMs  Duración de la ventana en milisegundos
 */
export async function persistentRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<PersistentRateLimitResult> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_ms: windowMs,
    });

    if (error || !data || data.length === 0) {
      // Si falla la BD, permitir la petición (fail-open) pero logear
      console.warn(`[PersistentRateLimit] Error BD para key ${key}:`, error?.message);
      return { allowed: true, count: 0, retryAfterSeconds: 0 };
    }

    const result = data[0];
    return {
      allowed: result.allowed as boolean,
      count: result.current_count as number,
      retryAfterSeconds: result.retry_after_seconds as number,
    };
  } catch (err: any) {
    console.warn(`[PersistentRateLimit] Excepción para key ${key}:`, err?.message);
    return { allowed: true, count: 0, retryAfterSeconds: 0 };
  }
}

/**
 * Registra un evento de seguridad en la tabla `security_events`.
 * Útil para auditoría y detección de patrones de ataque.
 */
export async function logSecurityEvent(params: {
  eventType: string;
  userId?: string | null;
  ipHash?: string | null;
  details?: Record<string, unknown>;
  severity?: "low" | "medium" | "high" | "critical";
}) {
  try {
    const supabase = getServiceClient();
    await supabase.from("security_events").insert({
      event_type: params.eventType,
      user_id: params.userId ?? null,
      ip_hash: params.ipHash ?? null,
      details: params.details ?? {},
      severity: params.severity ?? "medium",
    });
  } catch (err: any) {
    // No interrumpir el flujo principal si falla el log de seguridad
    console.error("[SecurityLog] Error al registrar evento:", err?.message);
  }
}

/**
 * Marca un retiro como anómalo para revisión del admin.
 */
export async function flagWithdrawalAnomaly(params: {
  withdrawalId: string;
  userId: string;
  wallet: string;
  points: number;
  reason: string;
}) {
  try {
    const supabase = getServiceClient();
    await supabase.from("withdrawal_anomalies").insert({
      withdrawal_id: params.withdrawalId,
      user_id: params.userId,
      wallet: params.wallet,
      points: params.points,
      reason: params.reason,
    });
    console.warn(`[Security] Retiro anómalo marcado: ${params.reason} | Usuario: ${params.userId}`);
  } catch (err: any) {
    console.error("[Security] Error al marcar anomalía:", err?.message);
  }
}
