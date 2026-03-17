import { headers } from "next/headers";
import { createHash } from "crypto";

/** Obtiene un hash del IP del request (para no guardar IPs en claro). */
export async function getRequestIpHash(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const real = h.get("x-real-ip");
  const ip = (forwarded?.split(",")[0]?.trim() || real || "unknown").trim();
  return createHash("sha256").update(ip).digest("hex");
}
