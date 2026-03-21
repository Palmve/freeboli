import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TTL_MINUTES = 60;

function getSecret(): string {
  return (
    process.env.EMAIL_VERIFICATION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "development" ? "dev-email-verification-secret-min-32-chars" : "")
  );
}

export function createEmailVerificationToken(payload: { userId: string; email: string; exp: number }): string {
  const secret = getSecret();
  if (!secret) throw new Error("Missing EMAIL_VERIFICATION_SECRET or NEXTAUTH_SECRET");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyEmailVerificationToken(token: string): { userId: string; email: string; exp: number } | null {
  const secret = getSecret();
  if (!secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      userId: string;
      email: string;
      exp: number;
    };
    if (!parsed?.userId || !parsed?.email || !parsed?.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createVerificationRequest(input: { userId: string; email: string; ttlMinutes?: number }) {
  const ttl = input.ttlMinutes ?? DEFAULT_TTL_MINUTES;
  const exp = Date.now() + ttl * 60_000;
  const token = createEmailVerificationToken({ userId: input.userId, email: input.email, exp });
  const tokenHash = hashToken(token);
  const supabase = await createClient();
  await supabase.from("email_verifications").insert({
    user_id: input.userId,
    token_hash: tokenHash,
    expires_at: new Date(exp).toISOString(),
  });
  return { token, exp };
}

