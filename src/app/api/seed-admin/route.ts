/**
 * Crea o actualiza el usuario admin en la BD.
 * Uso: http://localhost:3000/api/seed-admin (con npm run dev)
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "@/lib/password";
import { WELCOME_POINTS } from "@/lib/config";

const EMAIL = "albertonava@gmail.com";
const PASSWORD = "Humberto@2001#1";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Solo en desarrollo" }, { status: 404 });
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

    const { data: inserted, error } = await supabase
      .from("profiles")
      .insert({ email: EMAIL, name: "Alberto", password_hash, is_admin: true })
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
