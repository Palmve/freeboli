import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";
import { WELCOME_POINTS } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { headers } from "next/headers";
import { alertNewUser } from "@/lib/telegram";

function getIpFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const h = await headers();
  const ip = getIpFromHeaders(h);

  // Short-term burst limit: 3 per 15 min
  const burst = rateLimit(`register:${ip}`, 3, 15 * 60 * 1000);
  if (!burst.allowed) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${Math.ceil(burst.retryAfterSeconds / 60)} minuto(s).` },
      { status: 429 }
    );
  }

  // Daily cap: max 5 registrations per IP per 24h
  const daily = rateLimit(`register-day:${ip}`, 5, 24 * 60 * 60 * 1000);
  if (!daily.allowed) {
    return NextResponse.json(
      { error: "Límite de registros diarios alcanzado. Intenta mañana." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { email, password, referrerCode, _hp, _ts } = body;

  // Honeypot: if hidden field is filled, it's a bot
  if (_hp) {
    return NextResponse.json({ ok: true, userId: "ok" });
  }

  // Timing: reject if form was submitted in less than 3 seconds
  if (_ts && typeof _ts === "number") {
    const elapsed = Date.now() - _ts;
    if (elapsed < 3000) {
      return NextResponse.json(
        { error: "Por favor, completa el formulario con calma." },
        { status: 400 }
      );
    }
  }

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Correo y contraseña requeridos." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 }
    );
  }

  // Block disposable email providers
  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { error: "No se permiten correos temporales. Usa un correo real (Gmail, Outlook, etc.)." },
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
    const code = referrerCode.trim();
    const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code);
    if (isUuidLike) {
      const { data: ref } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", code)
        .single();
      referrerId = ref?.id ?? null;
    } else {
      const num = Number(code);
      if (Number.isInteger(num)) {
        const { data: ref } = await supabase
          .from("profiles")
          .select("id")
          .eq("public_id", num)
          .single();
        referrerId = ref?.id ?? null;
      }
    }
  }
  const password_hash = hashPassword(password);
  // Generate unique 6-digit public_id (retry on conflicts)
  let publicId: number | null = null;
  for (let i = 0; i < 12; i++) {
    publicId = Math.floor(Math.random() * 900000) + 100000;
    const { data: taken } = await supabase.from("profiles").select("id").eq("public_id", publicId).maybeSingle();
    if (!taken) break;
    publicId = null;
  }
  if (!publicId) {
    return NextResponse.json({ error: "No se pudo generar ID de usuario. Intenta de nuevo." }, { status: 500 });
  }
  const { data: inserted, error } = await supabase
    .from("profiles")
    .insert({
      email: email.toLowerCase().trim(),
      name: email.split("@")[0],
      password_hash,
      referrer_id: referrerId,
      public_id: publicId,
      referral_code: String(publicId),
      terms_accepted_at: new Date().toISOString(),
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

  alertNewUser(email, !!referrerId);

  return NextResponse.json({ ok: true, userId: inserted.id });
}
