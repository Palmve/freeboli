import { headers } from "next/headers";
import { createHash } from "crypto";

/** Obtiene un hash del IP del request (para no guardar IPs en claro). */
export async function getRequestIpHash(): Promise<string> {
  const ip = await getRequestIp();
  return createHash("sha256").update(ip).digest("hex");
}

/** Obtiene la IP real del request.
 * Prioriza cabeceras que el proxy de confianza (Vercel) sobreescribe y que el
 * cliente NO puede falsificar (x-vercel-forwarded-for, x-real-ip). Solo como
 * último recurso usa el primer valor de x-forwarded-for, que es spoofable. */
export async function getRequestIp(): Promise<string> {
  const h = await headers();
  const vercel = h.get("x-vercel-forwarded-for");
  const real = h.get("x-real-ip");
  const forwarded = h.get("x-forwarded-for");
  return (
    vercel?.split(",")[0]?.trim() ||
    real?.trim() ||
    forwarded?.split(",")[0]?.trim() ||
    "unknown"
  ).trim();
}
