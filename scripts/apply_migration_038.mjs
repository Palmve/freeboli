// Aplica la migración 038 (seed/init de settings) a producción vía la API REST de Supabase.
// Upsert idempotente en site_settings (no DDL). Lee credenciales de .env.local.
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
  { key: "PREDICTION_HOUSE_EDGE", value: 0.07 },
  { key: "PREDICTION_SIGMA_LIVE_BTC", value: { sigma: 0.0065, at: 0 } },
  { key: "PREDICTION_SIGMA_LIVE_SOL", value: { sigma: 0.012, at: 0 } },
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

const check = await fetch(`${URL_BASE}/rest/v1/site_settings?key=in.(PREDICTION_HOUSE_EDGE,PREDICTION_SIGMA_LIVE_BTC,PREDICTION_SIGMA_LIVE_SOL)&select=key,value`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
console.log("Verificación:", await check.text());
