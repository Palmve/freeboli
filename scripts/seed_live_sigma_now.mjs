// Activa la σ viva en producción AHORA (lo que hará el cron cada hora): computa σ realizada
// con computeRealizedSigma (node-safe) y hace upsert {sigma, at:now} en site_settings.
import { readFileSync } from "node:fs";
import { computeRealizedSigma } from "../src/lib/volatility.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const BASELINE = { BTC: 0.0065, SOL: 0.012 };
const rows = [];
for (const asset of ["BTC", "SOL"]) {
  const { sigma, ok } = await computeRealizedSigma(asset, BASELINE[asset]);
  console.log(`${asset}: sigma=${sigma} ok=${ok}`);
  if (ok) rows.push({ key: `PREDICTION_SIGMA_LIVE_${asset}`, value: { sigma, at: Date.now() } });
}
if (!rows.length) { console.error("Ninguna fuente respondió; no se escribe nada (degradación segura)."); process.exit(1); }

const res = await fetch(`${URL_BASE}/rest/v1/site_settings`, {
  method: "POST",
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify(rows),
});
const text = await res.text();
if (!res.ok) { console.error("ERROR upsert:", res.status, text); process.exit(1); }
console.log("Upsert OK:", text);
