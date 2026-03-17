/**
 * Crea el usuario admin albertonava@gmail.com con la clave indicada.
 * Uso: npm run seed  (carga .env.local si existe)
 */
const path = require("path");
const fs = require("fs");
function loadEnv(file) {
  const envPath = path.join(__dirname, "..", file);
  if (!fs.existsSync(envPath)) return;
  const env = fs.readFileSync(envPath, "utf8");
  env.split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  });
}
try {
  loadEnv(".env.local");
  loadEnv(".env");
} catch (_) {}
const { createClient } = require("@supabase/supabase-js");
const { scryptSync, randomBytes } = require("crypto");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = "albertonava@gmail.com";
const PASSWORD = "Humberto@2001#1";
const WELCOME_POINTS = Number(process.env.NEXT_PUBLIC_WELCOME_POINTS) || 100;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Falta NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o ANON). Carga .env.local o pásalos.");
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const password_hash = hashPassword(PASSWORD);

  const { data: existing } = await supabase.from("profiles").select("id").eq("email", EMAIL).single();
  if (existing) {
    await supabase.from("profiles").update({ password_hash, is_admin: true, updated_at: new Date().toISOString() }).eq("id", existing.id);
    const { data: bal } = await supabase.from("balances").select("points").eq("user_id", existing.id).single();
    const currentPoints = Number(bal?.points ?? 0);
    if (currentPoints === 0) {
      await supabase.from("balances").update({ points: WELCOME_POINTS, updated_at: new Date().toISOString() }).eq("user_id", existing.id);
      await supabase.from("movements").insert({
        user_id: existing.id,
        type: "recompensa",
        points: WELCOME_POINTS,
        reference: null,
        metadata: { source: "bienvenida" },
      });
      console.log("Usuario actualizado:", EMAIL, "+", WELCOME_POINTS, "puntos de bienvenida");
    } else {
      console.log("Usuario actualizado:", EMAIL, "(admin, clave actualizada)");
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("profiles")
      .insert({ email: EMAIL, name: "Alberto", password_hash, is_admin: true })
      .select("id")
      .single();
    if (error) {
      console.error("Error creando perfil:", error.message);
      process.exit(1);
    }
    await supabase.from("balances").insert({ user_id: inserted.id, points: WELCOME_POINTS });
    await supabase.from("movements").insert({
      user_id: inserted.id,
      type: "recompensa",
      points: WELCOME_POINTS,
      reference: null,
      metadata: { source: "bienvenida" },
    });
    console.log("Usuario creado:", EMAIL, "id:", inserted.id, "(admin,", WELCOME_POINTS, "puntos bienvenida)");
  }
  console.log("Añade en .env.local: ADMIN_EMAILS=albertonava@gmail.com  y  REQUIRE_AUTH=false  para modo local.");
}

main();
