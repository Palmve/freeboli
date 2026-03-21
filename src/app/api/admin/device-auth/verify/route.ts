import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { pin } = await req.json().catch(() => ({ pin: "" }));
  if (!pin || typeof pin !== "string" || pin.length !== 6) {
    return NextResponse.json({ error: "Formato de PIN inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const hashedPin = crypto.createHash("sha256").update(pin).digest("hex");
  
  const { data: tokens } = await supabase
    .from("email_verifications")
    .select("token_hash, expires_at")
    .eq("user_id", user.id)
    .eq("token_hash", hashedPin);

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const tokenRecord = tokens[0];
  if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "El PIN ha expirado. Solicita otro." }, { status: 401 });
  }

  // PIN válido. Proceder con el Fingerprinting.
  // 1. Destruimos el PIN para evitar re-usos (Replay Attacks).
  await supabase.from("email_verifications").delete().eq("user_id", user.id);

  // 2. Insertamos la galleta de reconocimiento de dispositivo a perpetuidad (3 Años).
  cookies().set("freeboli_device_trusted", "true", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365 * 3, 
  });

  return NextResponse.json({ success: true, message: "Dispositivo autorizado de forma permanente." });
}
