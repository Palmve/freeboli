import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";
import { WELCOME_POINTS } from "@/lib/config";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { email, password, referrerCode } = body;
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Correo y contraseña requeridos." },
      { status: 400 }
    );
  }
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .single();
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese correo." },
      { status: 409 }
    );
  }
  let referrerId: string | null = null;
  if (referrerCode && typeof referrerCode === "string") {
    const { data: ref } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", referrerCode.trim())
      .single();
    referrerId = ref?.id ?? null;
  }
  const password_hash = hashPassword(password);
  const { data: inserted, error } = await supabase
    .from("profiles")
    .insert({
      email: email.toLowerCase().trim(),
      name: email.split("@")[0],
      password_hash,
      referrer_id: referrerId,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json(
      { error: "Error al crear la cuenta." },
      { status: 500 }
    );
  }
  await supabase.from("balances").insert({ user_id: inserted.id, points: WELCOME_POINTS });
  await supabase.from("movements").insert({
    user_id: inserted.id,
    type: "recompensa",
    points: WELCOME_POINTS,
    reference: null,
    metadata: { source: "bienvenida" },
  });
  if (referrerId) {
    await supabase.from("referrals").insert({
      referrer_id: referrerId,
      referred_id: inserted.id,
    });
  }
  return NextResponse.json({ ok: true, userId: inserted.id });
}
