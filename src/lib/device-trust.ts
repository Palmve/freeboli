import { createHmac, timingSafeEqual } from "crypto";

/**
 * Cookie de "dispositivo de confianza" para el segundo factor (PIN) admin.
 *
 * SEGURIDAD: el valor NO es un literal "true" (falsificable por cookie-shadowing
 * incluso siendo httpOnly), sino un HMAC sobre el userId con un secreto del
 * servidor. Un atacante no puede forjar la cookie sin el secreto, así que no
 * puede saltarse el PIN aunque controle su propio navegador.
 */
function secret(): string {
  return (
    process.env.DEVICE_TRUST_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "development" ? "dev-device-trust-secret-min-32-chars" : "")
  );
}

export function deviceTrustCookieName(userId: string): string {
  return `freeboli_device_trusted_${userId.slice(0, 8)}`;
}

/** Valor firmado que se guarda en la cookie tras verificar el PIN. */
export function deviceTrustToken(userId: string): string {
  const s = secret();
  if (!s) return "";
  return createHmac("sha256", s).update(`device-trust:${userId}`).digest("hex");
}

/** Valida en tiempo constante que la cookie corresponde a este userId. */
export function verifyDeviceTrustValue(userId: string, value: string | undefined | null): boolean {
  if (!value) return false;
  const expected = deviceTrustToken(userId);
  if (!expected) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
