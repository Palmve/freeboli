// Aplica la migración 037 (seed de settings) a producción vía la API REST de Supabase.
// Es un upsert idempotente en site_settings (no DDL). Lee credenciales de .env.local.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const rows = [
  { key: "PREDICTION_MAX_ODDS", value: 10 },
  { key: "PREDICTION_MAX_ROUND_PAYOUT_PER_SIDE", value: 400000 },
];

const res = await fetch(`${URL_BASE}/rest/v1/site_settings`, {
  method: "POST",
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify(rows),
});
const text = await res.text();
if (!res.ok) { console.error("ERROR upsert:", res.status, text); process.exit(1); }
console.log("Upsert OK:", text);

// Verificación: leer de vuelta
const check = await fetch(`${URL_BASE}/rest/v1/site_settings?key=in.(PREDICTION_MAX_ODDS,PREDICTION_MAX_ROUND_PAYOUT_PER_SIDE)&select=key,value`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
console.log("Verificación:", await check.text());
