# σ viva (EWMA) para Predicciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estimar la volatilidad σ de BTC/SOL de forma viva (EWMA de klines horarias), precalculada en el cron horario y leída con piso conservador, para mantener `σ_modelo ≈ σ_real` y cerrar el riesgo de régimen de volatilidad en el modelo de cuotas de Predicciones.

**Architecture:** Cálculo puro de σ por EWMA en `src/lib/volatility.ts`; el cron horario (`master`) computa σ desde klines y la persiste en `site_settings` como objeto `{sigma, at}` por activo; la ruta de odds lee ese valor, aplica frescura (<3h) y piso `max(baseline)`, y lo pasa a `calculateDynamicOdds` vía un nuevo parámetro `sigmaOverride`. Ante cualquier fallo se degrada al baseline (comportamiento v1.161.0). Edge de la casa sube a 7%.

**Tech Stack:** TypeScript, Next.js (App Router), Supabase (admin client), Node 24 type-stripping para tests `.mjs` que importan los `.ts` reales. Sin framework de test (aserciones con `node:assert`).

**Spec:** `docs/superpowers/specs/2026-06-05-prediccion-sigma-viva-ewma-design.md`

---

## File Structure

- **Create** `src/lib/volatility.ts` — cálculo puro de σ (EWMA + clamp) y `computeRealizedSigma` (fetch klines). Responsabilidad única: estimar σ realizada.
- **Create** `scripts/volatility.test.mjs` — tests puros de EWMA/clamp (sin red).
- **Modify** `src/lib/price-oracle.ts` — `export` de `SIGMAS`; `calculateDynamicOdds` acepta `sigmaOverride`.
- **Modify** `src/lib/predictions.ts` — `resolveModelSigma` (puro) + `getModelSigma` (lee setting); `getActiveRoundWithOdds` pasa σ y edge 0.07.
- **Modify** `scripts/predictions_odds.test.mjs` — añadir asserts de `sigmaOverride` y `resolveModelSigma`.
- **Modify** `src/lib/cron-tasks.ts` — `updateLiveVolatility()` (escribe settings).
- **Modify** `src/app/api/cron/master/route.ts` — registrar el paso del cron.
- **Modify** `src/app/admin/configuracion/page.tsx` — entradas de admin para edge y σ live.
- **Create** `supabase/migrations/038_prediction_live_volatility.sql` — edge 0.07 + init σ live.
- **Modify** `src/lib/version.ts`, `package.json` — versión 1.162.0.

**Setting shape:** key `PREDICTION_SIGMA_LIVE_BTC` / `PREDICTION_SIGMA_LIVE_SOL`, value objeto `{ "sigma": number, "at": number }` (`at` = epoch ms del cálculo). `getSetting` devuelve el objeto ya parseado.

---

## Task 1: Cálculo puro de σ por EWMA (`ewmaSigmaFromCloses` + `clampSigma`)

**Files:**
- Create: `src/lib/volatility.ts`
- Test: `scripts/volatility.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/volatility.test.mjs`:

```javascript
// Tests puros de la estimación de σ (sin red). Importa el .ts real (Node 24 type-strip).
import assert from "node:assert/strict";
import { ewmaSigmaFromCloses, clampSigma } from "../src/lib/volatility.ts";

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

// 1) Serie con crecimiento multiplicativo constante g: r_i = ln(1+g) constante,
//    así la EWMA de r² converge a ln(1+g)² ⇒ σ = |ln(1+g)|.
const g = 0.003;
const closes = Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1 + g, i));
const sigma = ewmaSigmaFromCloses(closes);
assert.ok(sigma !== null, "σ no debería ser null con 59 retornos");
assert.ok(Math.abs(sigma - Math.abs(Math.log(1 + g))) < 1e-6, `σ ${sigma} != ${Math.abs(Math.log(1+g))}`);
ok("ewmaSigmaFromCloses: serie de retorno constante ⇒ σ = |ln(1+g)|");

// 2) Datos insuficientes (< 30 retornos) ⇒ null.
assert.equal(ewmaSigmaFromCloses(Array.from({ length: 10 }, (_, i) => 100 + i)), null);
ok("ewmaSigmaFromCloses: < 30 retornos ⇒ null");

// 3) Monotonía: más volátil ⇒ σ mayor.
const calm = Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1.001, i));
const wild = Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1.02, i));
assert.ok(ewmaSigmaFromCloses(wild) > ewmaSigmaFromCloses(calm), "σ(wild) > σ(calm)");
ok("ewmaSigmaFromCloses: monótona en volatilidad");

// 4) clampSigma acota a [baseline×0.5, baseline×4].
assert.equal(clampSigma(0.001, 0.0065), 0.0065 * 0.5); // por debajo del piso
assert.equal(clampSigma(0.05, 0.0065), 0.0065 * 4);     // por encima del techo
assert.equal(clampSigma(0.01, 0.0065), 0.01);           // dentro
ok("clampSigma: acota a [baseline×0.5, baseline×4]");

console.log(`\n✅ ${passed}/4 grupos de aserciones OK`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/volatility.test.mjs`
Expected: FAIL — `Cannot find module '../src/lib/volatility.ts'` (o `ewmaSigmaFromCloses is not a function`).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/volatility.ts`:

```typescript
/**
 * Estimación de volatilidad realizada (σ viva) para el modelo de cuotas de Predicciones.
 * σ = desviación típica del % de cambio en 1 hora (mismas unidades que SIGMAS de price-oracle).
 * Ver docs/superpowers/specs/2026-06-05-prediccion-sigma-viva-ewma-design.md
 */
import { SIGMAS } from "./price-oracle";

/** Memoria de la EWMA (λ≈0.97 ⇒ ~33h de memoria efectiva sobre datos horarios). */
const EWMA_LAMBDA = 0.97;
/** Mínimo de retornos para una estimación con sentido. */
const MIN_RETURNS = 30;

/**
 * σ horaria por EWMA de los retornos log de una serie de precios de cierre HORARIOS.
 * Asume deriva ~0 (martingala): usa r² directamente. Devuelve null si hay pocos datos.
 * Función PURA (sin red) → testeable con series inyectadas.
 */
export function ewmaSigmaFromCloses(closes: number[], lambda: number = EWMA_LAMBDA): number | null {
  const px = closes.filter((c) => typeof c === "number" && Number.isFinite(c) && c > 0);
  if (px.length < MIN_RETURNS + 1) return null;

  const returns: number[] = [];
  for (let i = 1; i < px.length; i++) returns.push(Math.log(px[i] / px[i - 1]));
  if (returns.length < MIN_RETURNS) return null;

  // Semilla: media de los primeros 10 r² (estabiliza el arranque), luego EWMA.
  const seedN = Math.min(10, returns.length);
  let variance = 0;
  for (let i = 0; i < seedN; i++) variance += returns[i] * returns[i];
  variance /= seedN;
  for (let i = seedN; i < returns.length; i++) {
    variance = lambda * variance + (1 - lambda) * returns[i] * returns[i];
  }
  return Math.sqrt(variance);
}

/** Acota σ a [baseline×0.5, baseline×4] contra datos anómalos. */
export function clampSigma(raw: number, baseline: number): number {
  return Math.max(baseline * 0.5, Math.min(baseline * 4, raw));
}
```

Also add `export` to `SIGMAS` in `src/lib/price-oracle.ts` (it is currently `const SIGMAS`):

```typescript
// price-oracle.ts — cambiar la declaración existente a exportada:
export const SIGMAS: Record<Asset, number> = {
  BTC: 0.0065,
  SOL: 0.012,
  BOLIS: 0.035,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/volatility.test.mjs`
Expected: PASS — `✅ 4/4 grupos de aserciones OK`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/volatility.ts src/lib/price-oracle.ts scripts/volatility.test.mjs
git commit -m "feat(predicciones): calculo puro de sigma realizada por EWMA + clamp"
```

---

## Task 2: `computeRealizedSigma` (fetch de klines Binance/Coinbase)

**Files:**
- Modify: `src/lib/volatility.ts`

Esta función hace red (klines) y no se testea unitariamente; su lógica pura (EWMA/clamp) ya quedó cubierta en Task 1. Se verifica con un dry-run manual.

- [ ] **Step 1: Add `computeRealizedSigma` to `src/lib/volatility.ts`**

Append:

```typescript
const FETCH_TIMEOUT_MS = 3500;

async function fetchJsonTimed(url: string): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, next: { revalidate: 0 } } as any);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Cierres horarios desde Binance (índice 4 de cada vela). ~168 velas = 7 días. */
async function binanceCloses(asset: "BTC" | "SOL"): Promise<number[] | null> {
  const symbol = asset === "BTC" ? "BTCUSDT" : "SOLUSDT";
  const d = await fetchJsonTimed(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=169`);
  if (!Array.isArray(d)) return null;
  const closes = d.map((k: any) => parseFloat(k?.[4])).filter((n) => Number.isFinite(n) && n > 0);
  return closes.length ? closes : null;
}

/** Fallback: cierres horarios desde Coinbase (índice 4; vienen del más nuevo al más viejo). */
async function coinbaseCloses(asset: "BTC" | "SOL"): Promise<number[] | null> {
  const product = asset === "BTC" ? "BTC-USD" : "SOL-USD";
  const d = await fetchJsonTimed(`https://api.exchange.coinbase.com/products/${product}/candles?granularity=3600`);
  if (!Array.isArray(d)) return null;
  // Cada vela: [time, low, high, open, close, volume]. Ordenar por time ascendente.
  const sorted = [...d].sort((a, b) => (a?.[0] ?? 0) - (b?.[0] ?? 0));
  const closes = sorted.map((k: any) => parseFloat(k?.[4])).filter((n) => Number.isFinite(n) && n > 0);
  return closes.length ? closes : null;
}

/**
 * σ realizada del activo: klines horarias (Binance→Coinbase) → EWMA → clamp a [×0.5, ×4]
 * del baseline. ok=false si la fuente falla o hay datos insuficientes (sigma = baseline).
 */
export async function computeRealizedSigma(asset: "BTC" | "SOL"): Promise<{ sigma: number; ok: boolean }> {
  const baseline = SIGMAS[asset];
  const closes = (await binanceCloses(asset)) ?? (await coinbaseCloses(asset));
  if (!closes) return { sigma: baseline, ok: false };
  const raw = ewmaSigmaFromCloses(closes);
  if (raw === null) return { sigma: baseline, ok: false };
  return { sigma: clampSigma(raw, baseline), ok: true };
}
```

- [ ] **Step 2: Dry-run manual contra los exchanges reales**

Run:
```bash
node --input-type=module -e "import('./src/lib/volatility.ts').then(async m=>{console.log('BTC', await m.computeRealizedSigma('BTC'));console.log('SOL', await m.computeRealizedSigma('SOL'));})"
```
Expected: dos objetos `{ sigma: <~0.003–0.02>, ok: true }`. (Si hay red bloqueada: `ok: false` y `sigma` = baseline — también válido como degradación.)

- [ ] **Step 3: Verify existing tests still pass**

Run: `node scripts/volatility.test.mjs`
Expected: PASS — `✅ 4/4`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/volatility.ts
git commit -m "feat(predicciones): computeRealizedSigma desde klines (Binance/Coinbase)"
```

---

## Task 3: `calculateDynamicOdds` acepta `sigmaOverride`

**Files:**
- Modify: `src/lib/price-oracle.ts`
- Test: `scripts/predictions_odds.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `scripts/predictions_odds.test.mjs` (antes de la línea final `console.log(...4 grupos...)`; ajusta el contador a 5):

```javascript
// 5) sigmaOverride: una σ mayor aplana las cuotas (menos confianza en el favorito).
for (const asset of ["BTC", "SOL"]) {
  const Pnow = 100.3;
  const oBase = calculateDynamicOdds("up", 100, Pnow, 1800, 3600, asset, EDGE);            // σ baseline
  const oHiVol = calculateDynamicOdds("up", 100, Pnow, 1800, 3600, asset, EDGE, 10, 0.03); // σ override alta
  assert.ok(oHiVol > oBase, `${asset}: σ mayor debería subir la cuota del favorito (${oHiVol} <= ${oBase})`);
  // La prob implícita con override debe seguir == Φ(z) con esa σ.
  const z = Math.log(Pnow / 100) / (0.03 / Math.sqrt(3600) * Math.sqrt(1800));
  const implied = (1 - EDGE) / oHiVol;
  if (oHiVol > 1.06 && oHiVol < 9.9) assert.ok(Math.abs(implied - normCdf(z)) < 0.01, `${asset}: implícita ${implied} != Φ(z) ${normCdf(z)}`);
}
ok("sigmaOverride: σ mayor aplana cuotas y la implícita sigue == Φ(z|σ)");
```

(Y cambia la línea final a `console.log(\`\n✅ ${passed}/5 grupos de aserciones OK\`);`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/predictions_odds.test.mjs`
Expected: FAIL — `calculateDynamicOdds` ignora el 9º argumento, `oHiVol === oBase` ⇒ assert falla.

- [ ] **Step 3: Add the `sigmaOverride` parameter**

In `src/lib/price-oracle.ts`, change the signature of `calculateDynamicOdds` (añade el parámetro tras `maxOddsCap`):

```typescript
export function calculateDynamicOdds(
  side: "up" | "down",
  startPrice: number,
  currentPrice: number,
  timeLeftSec: number,
  totalTimeSec: number = 3600,
  asset: Asset = "BTC",
  houseEdge: number = 0.05,
  maxOddsCap: number = 10,
  /** σ horaria a usar (σ viva). Si se omite, usa el baseline SIGMAS[asset]. */
  sigmaOverride?: number
): number {
```

And change the line that derives `sigPerSec` (currently `const sigPerSec = (SIGMAS[asset] || 0.006) / Math.sqrt(3600);`) to:

```typescript
  const sigmaHourly = (typeof sigmaOverride === "number" && sigmaOverride > 0)
    ? sigmaOverride
    : (SIGMAS[asset] || 0.006);
  const sigPerSec = sigmaHourly / Math.sqrt(3600);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/predictions_odds.test.mjs`
Expected: PASS — `✅ 5/5 grupos de aserciones OK`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/price-oracle.ts scripts/predictions_odds.test.mjs
git commit -m "feat(predicciones): calculateDynamicOdds acepta sigmaOverride (sigma viva)"
```

---

## Task 4: `resolveModelSigma` (decisión pura: frescura + piso)

**Files:**
- Modify: `src/lib/volatility.ts` (función pura `resolveModelSigma`)
- Modify: `src/lib/predictions.ts` (wrapper `getModelSigma`)
- Test: `scripts/volatility.test.mjs`

> Nota de diseño: `resolveModelSigma` es PURA y vive en `volatility.ts` (que solo importa
> `./price-oracle`, resoluble por Node en los tests `.mjs`). `predictions.ts` usa alias `@/…`
> que Node no resuelve, así que NO se importa desde un test — solo el wrapper `getModelSigma`
> (con IO) vive allí y se valida por typecheck/build.

- [ ] **Step 1: Write the failing test**

Append to `scripts/volatility.test.mjs` (antes de la línea final; ajusta contador a 5). Amplía el import superior existente para incluir `resolveModelSigma` desde `volatility.ts`:

```javascript
// import superior pasa a:
import { ewmaSigmaFromCloses, clampSigma, resolveModelSigma } from "../src/lib/volatility.ts";
```

```javascript
// 5) resolveModelSigma: frescura (<3h) y piso max(baseline).
const NOW = 1_000_000_000_000;
const H3 = 3 * 3600 * 1000;
const base = 0.0065;
// ausente ⇒ baseline
assert.equal(resolveModelSigma(null, null, NOW, base), base);
// viejo (>3h) ⇒ baseline
assert.equal(resolveModelSigma(0.02, NOW - H3 - 1, NOW, base), base);
// fresco y por encima del baseline ⇒ ese valor
assert.equal(resolveModelSigma(0.02, NOW - 1000, NOW, base), 0.02);
// fresco pero por debajo del baseline ⇒ piso = baseline
assert.equal(resolveModelSigma(0.001, NOW - 1000, NOW, base), base);
ok("resolveModelSigma: frescura <3h + piso max(baseline)");
```

(Cambia la línea final de `volatility.test.mjs` a `✅ ${passed}/5`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/volatility.test.mjs`
Expected: FAIL — `resolveModelSigma is not a function` (aún no existe / no exportada).

- [ ] **Step 3: Implement `resolveModelSigma` (volatility.ts) and `getModelSigma` (predictions.ts)**

In `src/lib/volatility.ts`, append the pure `resolveModelSigma`:

```typescript
/** 3h: tolera hasta 2 ticks horarios perdidos antes de caer al baseline. */
export const SIGMA_MAX_AGE_MS = 3 * 3600 * 1000;

/**
 * Decide la σ del modelo a partir del valor live leído: si falta o está viejo (>maxAge),
 * usa el baseline; si no, aplica el piso conservador max(valor, baseline). PURA.
 */
export function resolveModelSigma(
  rawSigma: number | null,
  atMillis: number | null,
  nowMillis: number,
  baseline: number,
  maxAgeMs: number = SIGMA_MAX_AGE_MS
): number {
  if (rawSigma == null || atMillis == null || nowMillis - atMillis > maxAgeMs) return baseline;
  return Math.max(rawSigma, baseline);
}
```

In `src/lib/predictions.ts`, add the imports and the IO wrapper `getModelSigma` (tras los imports existentes):

```typescript
import { SIGMAS } from "./price-oracle";
import { resolveModelSigma } from "./volatility";

/** σ del modelo para un activo, leyendo el setting live PREDICTION_SIGMA_LIVE_<ASSET>. */
export async function getModelSigma(asset: "BTC" | "SOL"): Promise<number> {
  const baseline = SIGMAS[asset];
  const live = await getSetting<{ sigma?: number; at?: number } | null>(`PREDICTION_SIGMA_LIVE_${asset}`, null);
  return resolveModelSigma(
    typeof live?.sigma === "number" ? live.sigma : null,
    typeof live?.at === "number" ? live.at : null,
    Date.now(),
    baseline
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/volatility.test.mjs`
Expected: PASS — `✅ 5/5`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/volatility.ts src/lib/predictions.ts scripts/volatility.test.mjs
git commit -m "feat(predicciones): resolveModelSigma/getModelSigma (frescura + piso baseline)"
```

---

## Task 5: Integrar σ viva y edge 7% en `getActiveRoundWithOdds`

**Files:**
- Modify: `src/lib/predictions.ts:103-115` (bloque de cálculo de odds)

- [ ] **Step 1: Modify the odds block**

In `getActiveRoundWithOdds`, reemplaza el bloque actual (que lee `houseEdge` y `maxOddsCap` y llama a `calculateDynamicOdds`) por:

```typescript
  const houseEdge = await getSetting<number>("PREDICTION_HOUSE_EDGE", 0.07);
  // Cap de cuota máxima (mitigación auditoría): 30x -> 10x por defecto, editable en admin.
  const maxOddsCap = await getSetting<number>("PREDICTION_MAX_ODDS", 10);

  if (round.type === "micro") {
    // (MICRO eliminado; se mantiene solo para resolver rondas antiguas que sigan vivas.)
    if (timeLeftSec >= 100) oddsMicro = 9;
    else if (timeLeftSec >= 80) oddsMicro = 8;
    else if (timeLeftSec > 60) oddsMicro = 7;
    else oddsMicro = 0;
  } else {
    const totalTimeSec = round.type === "mini" ? 600 : 3600;
    // σ viva (EWMA, precalculada por el cron): mantiene σ_modelo ≈ σ_real.
    const sigma = await getModelSigma(round.asset as "BTC" | "SOL");
    oddsUp = calculateDynamicOdds("up", round.opening_price, currentPrice, timeLeftSec, totalTimeSec, round.asset as any, houseEdge, maxOddsCap, sigma);
    oddsDown = calculateDynamicOdds("down", round.opening_price, currentPrice, timeLeftSec, totalTimeSec, round.asset as any, houseEdge, maxOddsCap, sigma);
  }
```

(El único cambio funcional respecto a v1.161.0 es el default de edge `0.05`→`0.07` y el nuevo argumento `sigma`.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Run the prediction tests**

Run: `node scripts/predictions_odds.test.mjs && node scripts/volatility.test.mjs`
Expected: ambos PASS (5/5 y 5/5).

- [ ] **Step 4: Commit**

```bash
git add src/lib/predictions.ts
git commit -m "feat(predicciones): getActiveRoundWithOdds usa sigma viva + edge 7%"
```

---

## Task 6: Tarea de cron `updateLiveVolatility` + registro en `master`

**Files:**
- Modify: `src/lib/cron-tasks.ts`
- Modify: `src/app/api/cron/master/route.ts`

- [ ] **Step 1: Add `updateLiveVolatility` to `src/lib/cron-tasks.ts`**

Add the import near the top (junto a los demás imports) y la función al final del archivo:

```typescript
import { computeRealizedSigma } from "@/lib/volatility";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearSettingsCache } from "@/lib/site-settings";
```

```typescript
/**
 * Precalcula la σ viva (EWMA de klines) de BTC/SOL y la persiste en site_settings como
 * objeto {sigma, at}. Si una fuente falla (ok=false), NO sobrescribe (conserva el último
 * bueno). La ruta de odds la lee con frescura<3h y piso max(baseline). Idempotente.
 */
export async function updateLiveVolatility(): Promise<{ ok: boolean; updated: string[]; skipped: string[] }> {
  const supabase = createAdminClient();
  const updated: string[] = [];
  const skipped: string[] = [];
  for (const asset of ["BTC", "SOL"] as const) {
    const { sigma, ok } = await computeRealizedSigma(asset);
    if (!ok) { skipped.push(asset); continue; }
    const { error } = await supabase
      .from("site_settings")
      .upsert(
        { key: `PREDICTION_SIGMA_LIVE_${asset}`, value: { sigma, at: Date.now() }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (error) skipped.push(asset); else updated.push(asset);
  }
  clearSettingsCache();
  return { ok: skipped.length === 0, updated, skipped };
}
```

- [ ] **Step 2: Register the step in `src/app/api/cron/master/route.ts`**

Add the import:

```typescript
import { processDeposits, awardPrizes, runDailySummary, updateLiveVolatility } from "@/lib/cron-tasks";
```

And add a new step after the predictions resolution step (tras el bloque `results.steps.predictions = ...`):

```typescript
  // 2.b Actualizar σ viva (EWMA) para el modelo de cuotas de Predicciones.
  try {
    results.steps.volatility = await updateLiveVolatility();
  } catch (e: any) {
    results.steps.volatility = { ok: false, error: e.message };
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cron-tasks.ts src/app/api/cron/master/route.ts
git commit -m "feat(predicciones): cron updateLiveVolatility persiste sigma viva por hora"
```

---

## Task 7: Migración 038 + entradas de admin

**Files:**
- Create: `supabase/migrations/038_prediction_live_volatility.sql`
- Modify: `src/app/admin/configuracion/page.tsx`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/038_prediction_live_volatility.sql`:

```sql
-- 038_prediction_live_volatility.sql
-- σ viva (EWMA) para el modelo de cuotas de Predicciones + colchón de edge.
-- Ver docs/superpowers/specs/2026-06-05-prediccion-sigma-viva-ewma-design.md
--
--  1) PREDICTION_HOUSE_EDGE 0.05 -> 0.07 (colchón ante error de estimación de σ).
--  2) Inicializa PREDICTION_SIGMA_LIVE_<asset> al baseline con at=0 (forzando el piso
--     baseline hasta que el primer tick del cron escriba la σ realizada). Objeto {sigma, at}.

INSERT INTO public.site_settings (key, value) VALUES
  ('PREDICTION_HOUSE_EDGE', '0.07'),
  ('PREDICTION_SIGMA_LIVE_BTC', '{"sigma":0.0065,"at":0}'),
  ('PREDICTION_SIGMA_LIVE_SOL', '{"sigma":0.012,"at":0}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

- [ ] **Step 2: Add admin config entries**

In `src/app/admin/configuracion/page.tsx`, después de la línea de `PREDICTION_MAX_ROUND_PAYOUT_PER_SIDE` (grupo "Predicciones (General)"), añade:

```typescript
  { key: "PREDICTION_SIGMA_LIVE_BTC", label: "σ viva BTC (auto)", type: "json", description: "Volatilidad realizada EWMA (auto-gestionada por el cron). Objeto {sigma, at}.", group: "Predicciones (General)" },
  { key: "PREDICTION_SIGMA_LIVE_SOL", label: "σ viva SOL (auto)", type: "json", description: "Volatilidad realizada EWMA (auto-gestionada por el cron). Objeto {sigma, at}.", group: "Predicciones (General)" },
```

And update the existing `PREDICTION_HOUSE_EDGE` entry's `defaultValue` from `"0.05"` to `"0.07"`:

```typescript
  { key: "PREDICTION_HOUSE_EDGE", label: "Comisión Casa (%)", type: "number", description: "Porcentaje de comisión (0.07 = 7%)", group: "Predicciones (General)", defaultValue: "0.07" },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/038_prediction_live_volatility.sql src/app/admin/configuracion/page.tsx
git commit -m "feat(predicciones): migracion 038 (edge 7% + init sigma live) + admin"
```

---

## Task 8: Verificación final, build, bump de versión

**Files:**
- Modify: `src/lib/version.ts`, `package.json`

- [ ] **Step 1: Run the full game test suite**

Run:
```bash
node scripts/volatility.test.mjs && node scripts/predictions_odds.test.mjs && node scripts/hilo_rtp.test.mjs && node scripts/hilo_pf.test.mjs
```
Expected: todos PASS (5/5, 5/5, 7/7, 6/6).

- [ ] **Step 2: Re-run the predictions audit (regresión)**

Run: `node scripts/audit_predictions.mjs`
Expected: el script usa su propio `HOUSE_EDGE=0.05` y σ baseline, así que con σ_real = σ_modelo
muestra momentum/sharp ≈ 96% y `Jugador MOMENTUM con edge > 0: NO` (confirma que la forma
funcional sigue intacta; el colchón real de edge 7% vive en producción vía setting).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: exit 0 (build correcto).

- [ ] **Step 4: Bump version to 1.162.0**

Edit `src/lib/version.ts`:

```typescript
export const APP_VERSION = "1.162.0";
```

And set `"version": "1.162.0"` in `package.json`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/version.ts package.json
git commit -m "chore(release): v1.162.0 (sigma viva EWMA en Predicciones)"
```

---

## Deploy (fuera de las tasks, requiere OK del usuario)

1. Aplicar migración **038** ANTES del deploy (sube edge a 0.07, inicializa σ live).
   - Vía REST upsert (como la 037) o en el panel de Supabase.
2. Push a `main` → Vercel auto-deploya (v1.162.0).
3. El primer tick horario del cron sustituye los σ init por los realizados; verificar en
   `site_settings` que `PREDICTION_SIGMA_LIVE_*.at` deja de ser 0.

---

## Notas de implementación

- **Degradación segura:** si `volatility.ts` o el cron fallan, `getModelSigma` cae al baseline
  y el sistema = v1.161.0 (ya auditado). Ningún fallo de red rompe la ruta de apuesta.
- **DRY:** el baseline σ vive SOLO en `SIGMAS` (price-oracle), exportado y reusado.
- **YAGNI:** sin σ separada mini/hourly (el modelo escala por √T_left), sin tabla de muestreo,
  sin λ/ventana configurables (constantes documentadas).
