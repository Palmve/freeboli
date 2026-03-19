import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashToken, verifyEmailVerificationToken } from "@/lib/email-verification";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return NextResponse.redirect(new URL("/cuenta?verified=0", url));

  const payload = verifyEmailVerificationToken(token);
  if (!payload) return NextResponse.redirect(new URL("/cuenta?verified=0", url));

  const supabase = await createClient();
  const tokenHash = hashToken(token);

  const { data: row } = await supabase
    .from("email_verifications")
    .select("id, used_at, expires_at")
    .eq("token_hash", tokenHash)
    .single();

  if (!row) return NextResponse.redirect(new URL("/cuenta?verified=0", url));
  if (row.used_at) return NextResponse.redirect(new URL("/cuenta?verified=1", url));

  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() > expiresAt) return NextResponse.redirect(new URL("/cuenta?verified=0", url));

  await supabase
    .from("profiles")
    .update({ email_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", payload.userId);

  await supabase
    .from("email_verifications")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);

  return NextResponse.redirect(new URL("/cuenta?verified=1", url));
}

