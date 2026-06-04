/**
 * Cloudflare Turnstile — verificación anti-bot de servidor.
 *
 * DISEÑO "DORMIDO": si no hay TURNSTILE_SECRET_KEY configurada, todas las
 * verificaciones son no-op (devuelven ok). Así el código puede desplegarse sin
 * cambiar el comportamiento actual; se ACTIVA solo cuando pegas las claves:
 *   - TURNSTILE_SECRET_KEY        (servidor, secreta)
 *   - NEXT_PUBLIC_TURNSTILE_SITE_KEY (cliente, pública — la usa el widget)
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** True si Turnstile está configurado en el servidor. */
export function isTurnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

/**
 * Verifica el token del widget contra Cloudflare.
 * - Si Turnstile está deshabilitado → { ok: true } (no-op).
 * - Si falla la red hacia Cloudflare → fail-open (ok) para no bloquear a
 *   usuarios legítimos ante una caída de CF; se deja traza en consola.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  ip?: string
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true }; // dormido

  if (!token) return { ok: false, reason: "Completa el desafío anti-bot." };

  try {
    const body = new URLSearchParams();
    body.append("secret", secret);
    body.append("response", token);
    if (ip && ip !== "unknown") body.append("remoteip", ip);

    const res = await fetch(VERIFY_URL, { method: "POST", body });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean };
    if (data?.success) return { ok: true };
    return { ok: false, reason: "Desafío anti-bot fallido. Inténtalo de nuevo." };
  } catch (err) {
    console.warn("[Turnstile] Error verificando token (fail-open):", (err as Error)?.message);
    return { ok: true };
  }
}
