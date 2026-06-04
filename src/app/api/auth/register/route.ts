import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";
import { WELCOME_POINTS } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { headers } from "next/headers";
import { alertNewUser } from "@/lib/telegram";
import { getSetting } from "@/lib/site-settings";
import { getRequestIpHash } from "@/lib/ip";
import { generateCaptcha, verifyCaptcha } from "@/lib/captcha";
import { canonicalizeEmail } from "@/lib/email-normalize";
import { logSecurityEvent } from "@/lib/security";
import { isTurnstileEnabled, verifyTurnstile } from "@/lib/turnstile";

function getIpFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const h = await headers();
  const ip = getIpFromHeaders(h);
  const ipHash = await getRequestIpHash();

  const burstMax = await getSetting<number>("REGISTER_BURST_MAX", 3);
  const burstWindowMin = await getSetting<number>("REGISTER_BURST_WINDOW_MINUTES", 15);
  const dailyMax = await getSetting<number>("REGISTER_DAILY_MAX", 5);
  const dailyWindowHours = await getSetting<number>("REGISTER_DAILY_WINDOW_HOURS", 24);
  const minSeconds = await getSetting<number>("REGISTER_MIN_SECONDS", 3);
  const enableDisposableBlock = await getSetting<number>("ENABLE_DISPOSABLE_BLOCK", 1);
  const requireCaptcha = await getSetting<number>("REGISTER_CAPTCHA_REQUIRED", 1);

  const burst = rateLimit(`register:${ip}`, burstMax, burstWindowMin * 60 * 1000);
  if (!burst.allowed) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${Math.ceil(burst.retryAfterSeconds / 60)} minuto(s).` },
      { status: 429 }
    );
  }

  const daily = rateLimit(`register-day:${ip}`, dailyMax, dailyWindowHours * 60 * 60 * 1000);
  if (!daily.allowed) {
    return NextResponse.json(
      { error: "Límite de registros diarios alcanzado. Intenta mañana." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { email, password, referrerCode, _hp, _ts, captchaAnswer, captchaToken, turnstileToken } = body;

  if (_hp) {
    return NextResponse.json({ ok: true, userId: "ok" });
  }

  // Anti-bot fuerte (Cloudflare Turnstile). Dormido si no hay clave configurada.
  const turnstileOn = isTurnstileEnabled();
  if (turnstileOn) {
    const ts = await verifyTurnstile(turnstileToken, ip);
    if (!ts.ok) {
      return NextResponse.json({ error: ts.reason || "Verificación anti-bot fallida." }, { status: 403 });
    }
  }

  const supabase = await createClient();

  // 0. Bloqueo de IP de Usuarios Suspendidos (Anti-Sybil / Anti-Abuso)
  const { data: bannedIps } = await supabase
    .from("session_ips")
    .select("user_id, profiles!inner(status)")
    .eq("ip_hash", ipHash)
    .in("profiles.status", ["suspendido", "bloqueado"]);

  if (bannedIps && bannedIps.length > 0) {
    console.warn(`[Security] Intento de registro bloqueado por IP BAN para ${email} (IP Hash: ${ipHash})`);
    return NextResponse.json(
      { error: "Esta conexión está restringida debido a una infracción de los términos en una cuenta asociada. Si crees que es un error, contacta a soporte." },
      { status: 403 }
    );
  }

  // 0.5 Smart CAPTCHA Check (UX Optimizado)
  // Dominios "confiables" que no ven captcha a menos que haya spam previo.
  const trustedDomains = ["gmail.com", "outlook.com", "hotmail.com", "icloud.com", "yahoo.com", "proton.me", "protonmail.com"];
  const userDomain = email.split("@")[1]?.toLowerCase().trim();
  const isTrustedDomain = trustedDomains.includes(userDomain);

  if (!turnstileOn && requireCaptcha === 1) {
    // Solo forzamos CAPTCHA matemático si Turnstile NO está activo. Si:
    // 1. El dominio NO es confiable.
    // 2. O si el usuario YA envió un intento (captchaToken presente).
    // 3. O si la IP ya tiene cuentas asociadas (aunque no estén baneadas, para evitar bots).
    const { count: ipUsage } = await supabase
      .from("session_ips")
      .select("user_id", { count: "exact", head: true })
      .eq("ip_hash", ipHash);

    const shouldForceCaptcha = !isTrustedDomain || (ipUsage && ipUsage > 0) || !!captchaToken;

    if (shouldForceCaptcha) {
      if (!captchaToken || captchaAnswer == null) {
        const challenge = generateCaptcha(0); 
        return NextResponse.json({ 
          requireCaptcha: true, 
          captcha: challenge,
          error: isTrustedDomain 
            ? "Verificación adicional requerida por seguridad." 
            : "Se requiere CAPTCHA para dominios de correo no verificados."
        }, { status: 403 });
      }

      const verify = verifyCaptcha(Number(captchaAnswer), captchaToken);
      if (!verify.valid) {
        const challenge = generateCaptcha(1);
        return NextResponse.json({ 
          requireCaptcha: true, 
          captcha: challenge,
          error: "Captcha incorrecto o expirado." 
        }, { status: 403 });
      }
    }
  }

  if (_ts && typeof _ts === "number") {
    const elapsed = Date.now() - _ts;
    const minMs = minSeconds * 1000;
    if (elapsed < minMs) {
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 255) {
    return NextResponse.json(
      { error: "El formato del correo electrónico es inválido o demasiado largo." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 }
    );
  }

  if (enableDisposableBlock === 1 && isDisposableEmail(email)) {
    return NextResponse.json(
      { error: "No se permiten correos temporales. Usa un correo real (Gmail, Outlook, etc.)." },
      { status: 400 }
    );
  }
  const normalizedEmail = email.toLowerCase().trim();
  const emailCanonical = canonicalizeEmail(normalizedEmail);

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .single();
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese correo." },
      { status: 409 }
    );
  }

  // Anti-Sybil: bloquear alias de la misma bandeja (gmail +tag / puntos, etc.)
  const { data: canonicalDup } = await supabase
    .from("profiles")
    .select("id")
    .eq("email_canonical", emailCanonical)
    .limit(1)
    .maybeSingle();
  if (canonicalDup) {
    return NextResponse.json(
      { error: "Ya existe una cuenta asociada a esa bandeja de correo." },
      { status: 409 }
    );
  }
  let referrerId: string | null = null;
  let referrerRegIp: string | null = null;
  if (referrerCode && typeof referrerCode === "string") {
    const code = referrerCode.trim();
    const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code);
    if (isUuidLike) {
      const { data: ref } = await supabase
        .from("profiles")
        .select("id, registration_ip")
        .eq("id", code)
        .single();
      referrerId = ref?.id ?? null;
      referrerRegIp = ref?.registration_ip ?? null;
    } else {
      const num = Number(code);
      if (Number.isInteger(num)) {
        const { data: ref } = await supabase
          .from("profiles")
          .select("id, registration_ip")
          .eq("public_id", num)
          .single();
        referrerId = ref?.id ?? null;
        referrerRegIp = ref?.registration_ip ?? null;
      }
    }
  }

  // Anti-Sybil: alta que usa el enlace de un referente con la MISMA IP de alta.
  // No se bloquea (NAT/hogares comparten IP), pero se marca a 'evaluar' y se
  // registra evento para revisión del admin.
  const sameIpReferral = !!(referrerId && referrerRegIp && ip !== "unknown" && referrerRegIp === ip);
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
      email: normalizedEmail,
      email_canonical: emailCanonical,
      name: email.split("@")[0],
      password_hash,
      referrer_id: referrerId,
      public_id: publicId,
      referral_code: String(publicId),
      terms_accepted_at: new Date().toISOString(),
      last_ip: ip,
      registration_ip: ip,
      status: sameIpReferral ? "evaluar" : "normal",
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

  if (sameIpReferral) {
    await logSecurityEvent({
      eventType: "sybil_same_ip_referral_signup",
      userId: inserted.id,
      ipHash,
      details: { referrerId, note: "Alta vía referido con misma IP de registro" },
      severity: "high",
    }).catch(() => {});
  }

  await alertNewUser(email, !!referrerId);

  return NextResponse.json({ ok: true, userId: inserted.id });
}
