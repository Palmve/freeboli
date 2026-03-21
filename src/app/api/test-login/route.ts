/**
 * Solo en desarrollo: comprueba email/contraseña contra la BD (sin crear sesión).
 * Preferible probar con POST + body para no dejar la clave en historial del navegador.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.REQUIRE_AUTH === "true") {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const email = body.email;
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Falta email o password (query params)" },
      { status: 400 }
    );
  }
  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, password_hash")
      .eq("email", email.trim().toLowerCase())
      .single();
    if (error || !profile) {
      return NextResponse.json({
        ok: false,
        error: "Usuario no encontrado. Ejecuta: npm run seed",
      });
    }
    if (!profile.password_hash) {
      return NextResponse.json({
        ok: false,
        error: "Usuario sin contraseña. Ejecuta: npm run seed",
      });
    }
    const valid = verifyPassword(password, profile.password_hash);
    const { data: balance } = await supabase
      .from("balances")
      .select("points")
      .eq("user_id", profile.id)
      .single();
    return NextResponse.json({
      ok: valid,
      error: valid ? undefined : "Clave incorrecta",
      userId: profile.id,
      points: balance?.points ?? 0,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: String(e instanceof Error ? e.message : e),
    });
  }
}
