/**
 * Crea o actualiza un usuario admin en la BD (solo desarrollo).
 * Define SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en .env.local (no subir al repositorio).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "@/lib/password";
import { WELCOME_POINTS } from "@/lib/config";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Solo en desarrollo" }, { status: 404 });
  }
  const EMAIL = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const PASSWORD = process.env.SEED_ADMIN_PASSWORD || "";
  if (!EMAIL || !PASSWORD) {
    return NextResponse.json(
      {
        ok: false,
        error: "Define SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en .env.local para usar esta ruta.",
      },
      { status: 400 }
    );
  }
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({
        ok: false,
        error: "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
      });
    }
    const supabase = createClient(url, key);
    const password_hash = hashPassword(PASSWORD);

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", EMAIL)
      .single();

    if (existing) {
      await supabase
        .from("profiles")
        .update({ password_hash, is_admin: true, updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      const { data: bal } = await supabase
        .from("balances")
        .select("points")
        .eq("user_id", existing.id)
        .single();
      const currentPoints = Number(bal?.points ?? 0);

      if (currentPoints === 0) {
        await supabase
          .from("balances")
          .update({ points: WELCOME_POINTS, updated_at: new Date().toISOString() })
          .eq("user_id", existing.id);
        await supabase.from("movements").insert({
          user_id: existing.id,
          type: "recompensa",
          points: WELCOME_POINTS,
          reference: null,
          metadata: { source: "bienvenida" },
        });
      }

      return NextResponse.json({
        ok: true,
        message: "Usuario actualizado: " + EMAIL,
        userId: existing.id,
        points: currentPoints === 0 ? WELCOME_POINTS : currentPoints,
      });
    }

    const seedName = (process.env.SEED_ADMIN_NAME || "Admin").trim() || "Admin";
    const { data: inserted, error } = await supabase
      .from("profiles")
      .insert({ email: EMAIL, name: seedName, password_hash, is_admin: true })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        hint: "¿Ejecutaste el SQL de supabase/migrations/001_initial.sql en Supabase (SQL Editor)?",
      });
    }

    await supabase.from("balances").insert({ user_id: inserted.id, points: WELCOME_POINTS });
    await supabase.from("movements").insert({
      user_id: inserted.id,
      type: "recompensa",
      points: WELCOME_POINTS,
      reference: null,
      metadata: { source: "bienvenida" },
    });

    return NextResponse.json({
      ok: true,
      message: "Usuario creado: " + EMAIL,
      userId: inserted.id,
      points: WELCOME_POINTS,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      error: msg,
      hint: "¿Tienes en .env.local NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (o SUPABASE_SERVICE_ROLE_KEY)?",
    });
  }
}
