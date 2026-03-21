import { NextResponse } from "next/server";

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

/**
 * Protege rutas invocadas por cron o servicios internos.
 * En producción exige CRON_SECRET y cabecera Authorization: Bearer <secret>.
 * En desarrollo, si CRON_SECRET está definido también se exige; si no, se permite (local sin secret).
 */
export function requireCronSecret(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (isProductionRuntime()) {
    if (!secret) {
      return NextResponse.json(
        { error: "CRON_SECRET no configurado en el servidor." },
        { status: 503 }
      );
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    return null;
  }
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return null;
}

export function isCronSecretAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}
