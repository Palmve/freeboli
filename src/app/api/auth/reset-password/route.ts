import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";
import { hashToken, verifyEmailVerificationToken } from "@/lib/email-verification";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(req: Request) {
  // Nota: si ya hay sesión, igual permitimos el reset por seguridad (pero el token manda).
  await getCurrentUser().catch(() => null);

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!token) return NextResponse.json({ error: "Token requerido." }, { status: 400 });
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const payload = verifyEmailVerificationToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Token inválido o expirado." }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("password_resets")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .single();

  if (!row?.user_id) {
    return NextResponse.json({ error: "Token inválido o ya usado." }, { status: 400 });
  }

  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() > expiresAt) {
    return NextResponse.json({ error: "Token expirado." }, { status: 400 });
  }
  if (row.used_at) {
    return NextResponse.json({ error: "Token ya usado." }, { status: 400 });
  }

  const password_hash = hashPassword(newPassword);
  await supabase
    .from("profiles")
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq("id", row.user_id);

  await supabase
    .from("password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);

  return NextResponse.json({ ok: true });
}

