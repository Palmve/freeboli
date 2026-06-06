# Wagering (M1) + Tope global de pagos (M2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que las fichas de bono (faucet/bienvenida/comisiones/recompensas) se retiren como BOLIS sin pasar por el casino (wagering 20x) y poner un tope global diario de pagos on-chain (default 500 BOLIS → `pending`).

**Architecture:** Un único saldo jugable (`balances.points`) más dos contadores nuevos (`locked_points`, `wagering_remaining`); invariante `retirable = max(0, points − locked_points)`. Los créditos de bono suman a `locked`+`wagering` vía RPC `credit_bonus_points`; las apuestas (HI-LO y predicciones) decrementan `wagering` y limpian `locked` al llegar a 0; el retiro valida saldo retirable dentro del RPC. El tope global vive en la ruta de retiro (decisión auto vs `pending`).

**Tech Stack:** Next.js 14 (App Router, route handlers), Supabase (Postgres + RPC plpgsql, `SECURITY DEFINER`), TypeScript. Tests de lógica pura con el runner incorporado `node --test` (sin dependencias nuevas). Migraciones SQL en `supabase/migrations/`.

**Spec de referencia:** `docs/superpowers/specs/2026-06-05-wagering-y-tope-global-retiros-design.md`

---

## Estructura de archivos

**Crear:**
- `src/lib/wagering.ts` — funciones puras: `computeWithdrawable`, `bonusCredit`, `applyWager`, `isGlobalCapReached`. Fuente de verdad de la matemática (espejada en SQL).
- `scripts/test_wagering.mjs` — tests con `node --test` de `src/lib/wagering.ts` (compilado o importado vía tsx; ver Task 1).
- `supabase/migrations/039_wagering_locked_balance.sql` — columnas nuevas + `credit_bonus_points` + redefinición de `place_hilo_bet`, `place_prediction_bet`, `create_withdrawal_request` + settings.
- `scripts/verify_wagering_rpcs.mjs` — smoke test de los RPCs contra la BD (REST/service role), patrón de `scripts/apply_migration_038*`.

**Modificar:**
- `src/app/api/faucet/route.ts` — payout del faucet y comisión de afiliado faucet → `credit_bonus_points`; GET expone `wageringRemaining`/`withdrawable`.
- `src/app/api/auth/register/route.ts` — `WELCOME_POINTS` → `credit_bonus_points`.
- `src/app/api/affiliates/route.ts` — bono de referido verificado → `credit_bonus_points`.
- `src/app/api/predictions/bet/route.ts` — comisión de afiliado de juego → `credit_bonus_points`.
- `src/app/api/hi-lo/play/route.ts` — comisión de afiliado de juego → `credit_bonus_points`.
- `src/lib/levels.ts` — `rewardPoints` por subida de nivel → `credit_bonus_points`.
- `src/app/api/withdraw/route.ts` — mensaje M1 (retirable) + lógica M2 (tope global → `pending`) + `code`/`params`/`pendingReason` en todas las respuestas.
- `src/app/cuenta/retirar/page.tsx` — traduce las respuestas del servidor por `code`/`pendingReason` (es/en).
- `src/i18n/es.json`, `src/i18n/en.json` — claves bilingües de todas las reglas de retiro + objeto `wagering`.
- `src/app/admin/configuracion/page.tsx` — settings `WAGERING_MULTIPLIER` y `WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS`.
- `package.json` (+ `src/lib/version.ts`) — script de test y bump de versión.

---

## Task 1: Lógica pura de wagering (`src/lib/wagering.ts`)

**Files:**
- Create: `src/lib/wagering.ts`
- Create: `scripts/test_wagering.mjs`
- Modify: `package.json` (añadir script `test`)

- [ ] **Step 1: Añadir script de test a `package.json`**

En el bloque `"scripts"` añade la línea `test` (ejecuta el runner incorporado sobre el directorio de scripts de test, usando tsx para importar TS):

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "seed": "node scripts/seed-admin.cjs",
    "test": "node --test --import tsx scripts/"
  },
```

Y añade `tsx` como dependencia de desarrollo:

```bash
npm install -D tsx
```

- [ ] **Step 2: Escribir el test que falla**

Crea `scripts/test_wagering.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWithdrawable, bonusCredit, applyWager, isGlobalCapReached } from "../src/lib/wagering.ts";

test("retirable = max(0, points - locked)", () => {
  assert.equal(computeWithdrawable({ points: 200, lockedPoints: 0 }), 200);
  assert.equal(computeWithdrawable({ points: 200, lockedPoints: 50 }), 150);
  assert.equal(computeWithdrawable({ points: 30, lockedPoints: 100 }), 0); // nunca negativo
});

test("acreditar bono bloquea principal y suma wagering = monto * mult", () => {
  const r = bonusCredit({ points: 0, lockedPoints: 0, wageringRemaining: 0 }, 100, 20);
  assert.deepEqual(r, { points: 100, lockedPoints: 100, wageringRemaining: 2000 });
});

test("apostar reduce wagering por el importe (gane o pierda)", () => {
  const r = applyWager({ points: 100, lockedPoints: 100, wageringRemaining: 2000 }, 500);
  assert.equal(r.wageringRemaining, 1500);
  assert.equal(r.lockedPoints, 100); // aún bloqueado
});

test("al llegar wagering a 0, el lock se limpia (todo retirable)", () => {
  const r = applyWager({ points: 100, lockedPoints: 100, wageringRemaining: 400 }, 500);
  assert.equal(r.wageringRemaining, 0);
  assert.equal(r.lockedPoints, 0);
});

test("depósito no bloquea: usa points sin tocar locked (se modela fuera de bonusCredit)", () => {
  // un crédito cash es simplemente points += D, locked sin cambios
  assert.equal(computeWithdrawable({ points: 100 + 50, lockedPoints: 100 }), 50);
});

test("tope global: pending solo si pagado_hoy + este > cap", () => {
  assert.equal(isGlobalCapReached({ paidBolisToday: 450, thisBolis: 10, capBolis: 500 }), false);
  assert.equal(isGlobalCapReached({ paidBolisToday: 495, thisBolis: 10, capBolis: 500 }), true);
  assert.equal(isGlobalCapReached({ paidBolisToday: 0, thisBolis: 600, capBolis: 500 }), true);
});
```

- [ ] **Step 3: Ejecutar el test y verificar que FALLA**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/lib/wagering.ts'` (aún no existe).

- [ ] **Step 4: Implementar `src/lib/wagering.ts`**

```ts
/**
 * Lógica pura del requisito de apuesta (wagering) y del tope global de pagos.
 * Fuente de verdad de la matemática; los RPCs SQL (migración 039) la espejan.
 * Invariante: retirable = max(0, points - lockedPoints).
 */

export interface BalanceState {
  points: number;
  lockedPoints: number;
  wageringRemaining: number;
}

/** Fichas que el usuario puede retirar ahora mismo. */
export function computeWithdrawable(b: { points: number; lockedPoints: number }): number {
  return Math.max(0, b.points - b.lockedPoints);
}

/** Acredita un bono: bloquea el principal y añade requisito de apuesta = monto * mult. */
export function bonusCredit(b: BalanceState, amount: number, mult: number): BalanceState {
  return {
    points: b.points + amount,
    lockedPoints: b.lockedPoints + amount,
    wageringRemaining: b.wageringRemaining + amount * mult,
  };
}

/** Aplica una apuesta de importe `bet`: reduce wagering; al llegar a 0 limpia el lock. */
export function applyWager(b: BalanceState, bet: number): BalanceState {
  const remaining = Math.max(0, b.wageringRemaining - bet);
  return {
    points: b.points,
    lockedPoints: remaining === 0 ? 0 : b.lockedPoints,
    wageringRemaining: remaining,
  };
}

/** Tope global diario de pagos on-chain: ¿este retiro superaría el presupuesto del día? */
export function isGlobalCapReached(args: {
  paidBolisToday: number;
  thisBolis: number;
  capBolis: number;
}): boolean {
  return args.paidBolisToday + args.thisBolis > args.capBolis;
}
```

- [ ] **Step 5: Ejecutar el test y verificar que PASA**

Run: `npm test`
Expected: PASS — los 6 tests en verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/wagering.ts scripts/test_wagering.mjs package.json package-lock.json
git commit -m "feat(wagering): lógica pura de wagering + tope global con tests"
```

---

## Task 2: Migración 039 — columnas + RPCs

**Files:**
- Create: `supabase/migrations/039_wagering_locked_balance.sql`

> SQL basada en las definiciones vigentes: `atomic_add_points`/`place_prediction_bet`/`atomic_add_hilo_prize` (016), `place_hilo_bet` (017), `create_withdrawal_request` (028). El truco clave: dentro de un `UPDATE`, todas las expresiones `SET` se evalúan contra los valores PREVIOS de la fila, así que se puede decrementar `wagering_remaining` y decidir `locked_points` en la misma sentencia.

- [ ] **Step 1: Crear el archivo de migración**

Crea `supabase/migrations/039_wagering_locked_balance.sql`:

```sql
-- 039_wagering_locked_balance.sql
-- M1 (wagering) + soporte para M2 (settings).
-- Añade contadores de bono a balances e integra el wagering en los RPCs de juego y retiro.
-- Grandfather: columnas DEFAULT 0 => saldos existentes quedan 100% retirables.

-- 1. Columnas nuevas (grandfather con default 0)
ALTER TABLE public.balances
  ADD COLUMN IF NOT EXISTS locked_points BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wagering_remaining BIGINT NOT NULL DEFAULT 0;

-- 2. credit_bonus_points: acredita bono bloqueando principal + sumando wagering
CREATE OR REPLACE FUNCTION public.credit_bonus_points(
    p_user_id UUID,
    p_amount BIGINT,
    p_wager_mult INTEGER
)
RETURNS TABLE (
    success BOOLEAN,
    result_balance BIGINT
) AS $$
DECLARE
    new_bal BIGINT;
BEGIN
    INSERT INTO public.balances (user_id, points, locked_points, wagering_remaining, updated_at)
    VALUES (p_user_id, p_amount, p_amount, p_amount * p_wager_mult, now())
    ON CONFLICT (user_id) DO UPDATE SET
        points = public.balances.points + EXCLUDED.points,
        locked_points = public.balances.locked_points + EXCLUDED.locked_points,
        wagering_remaining = public.balances.wagering_remaining + EXCLUDED.wagering_remaining,
        updated_at = now()
    RETURNING points INTO new_bal;

    RETURN QUERY SELECT TRUE, new_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.credit_bonus_points IS 'Acredita un bono: points += amount, locked_points += amount, wagering_remaining += amount*mult.';

-- 3. place_hilo_bet: redefinida con decremento de wagering + limpieza de lock
CREATE OR REPLACE FUNCTION public.place_hilo_bet(
    p_user_id UUID,
    p_amount BIGINT
)
RETURNS TABLE (
    success BOOLEAN,
    result_balance BIGINT
) AS $$
DECLARE
    new_bal BIGINT;
BEGIN
    -- Todas las expresiones SET usan los valores PREVIOS de la fila.
    UPDATE public.balances SET
        points = points - p_amount,
        wagering_remaining = GREATEST(0, wagering_remaining - p_amount),
        locked_points = CASE WHEN (wagering_remaining - p_amount) <= 0 THEN 0 ELSE locked_points END,
        updated_at = now()
    WHERE user_id = p_user_id AND points >= p_amount
    RETURNING points INTO new_bal;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::BIGINT;
    ELSE
        UPDATE public.profiles SET hilo_bet_count = hilo_bet_count + 1 WHERE id = p_user_id;
        RETURN QUERY SELECT TRUE, new_bal;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. place_prediction_bet: redefinida (cuerpo de 016 + decremento de wagering)
CREATE OR REPLACE FUNCTION public.place_prediction_bet(
    p_user_id UUID,
    p_round_id UUID,
    p_amount BIGINT,
    p_prediction TEXT,
    p_type TEXT,
    p_odds NUMERIC,
    p_payout BIGINT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    result_balance BIGINT
) AS $$
DECLARE
    current_bal BIGINT;
    bet_count INTEGER;
BEGIN
    SELECT points INTO current_bal FROM public.balances WHERE user_id = p_user_id FOR UPDATE;

    IF current_bal IS NULL OR current_bal < p_amount THEN
        RETURN QUERY SELECT FALSE, 'Saldo insuficiente', COALESCE(current_bal, 0);
        RETURN;
    END IF;

    SELECT count(*) INTO bet_count FROM public.prediction_bets WHERE round_id = p_round_id AND user_id = p_user_id;

    IF bet_count >= 5 THEN
        RETURN QUERY SELECT FALSE, 'Límite de 5 apuestas por ronda alcanzado', current_bal;
        RETURN;
    END IF;

    -- Descuento + decremento de wagering + limpieza de lock (valores PREVIOS en SET).
    UPDATE public.balances SET
        points = points - p_amount,
        wagering_remaining = GREATEST(0, wagering_remaining - p_amount),
        locked_points = CASE WHEN (wagering_remaining - p_amount) <= 0 THEN 0 ELSE locked_points END,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING points INTO current_bal;

    INSERT INTO public.prediction_bets (round_id, user_id, type, amount, prediction, odds_at_bet, potential_payout)
    VALUES (p_round_id, p_user_id, p_type, p_amount, p_prediction, p_odds, p_payout);

    INSERT INTO public.movements (user_id, type, points, metadata)
    VALUES (p_user_id, 'apuesta_prediccion', -p_amount, jsonb_build_object('round_id', p_round_id, 'odds', p_odds, 'prediction', p_prediction));

    RETURN QUERY SELECT TRUE, 'Apuesta realizada con éxito', current_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. create_withdrawal_request: redefinida (cuerpo de 028 + gate de retirable)
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
    target_user_id UUID,
    amount_points BIGINT,
    dest_wallet TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    withdrawal_id UUID,
    result_balance BIGINT,
    error_message TEXT
) AS $$
DECLARE
    current_bal BIGINT;
    v_locked BIGINT;
    new_withdrawal_id UUID;
    v_status TEXT := 'pending';
    v_is_influencer BOOLEAN := FALSE;
    v_max_amount BIGINT := 999999999;
    v_max_daily INTEGER := 99;
    v_daily_count INTEGER;
    v_auto_approve BOOLEAN := FALSE;
BEGIN
    SELECT TRUE, max_withdrawal_amount, max_daily_withdrawals, auto_approve_withdrawals
    INTO v_is_influencer, v_max_amount, v_max_daily, v_auto_approve
    FROM influencer_configs
    WHERE user_id = target_user_id AND is_active = TRUE;

    v_is_influencer := COALESCE(v_is_influencer, FALSE);

    IF amount_points > v_max_amount THEN
        -- error_message = CÓDIGO estable (el frontend lo traduce a es/en).
        RETURN QUERY SELECT FALSE, NULL::UUID, 0::BIGINT, 'influencer_amount_exceeded';
        RETURN;
    END IF;

    IF v_is_influencer THEN
        SELECT COUNT(*)::INTEGER INTO v_daily_count
        FROM withdrawals
        WHERE user_id = target_user_id
          AND created_at > NOW() - INTERVAL '24 hours';

        IF v_daily_count >= v_max_daily THEN
            RETURN QUERY SELECT FALSE, NULL::UUID, 0::BIGINT, 'influencer_daily_limit';
            RETURN;
        END IF;

        IF v_auto_approve THEN
            v_status := 'processing';
        END IF;
    END IF;

    -- Bloqueo de fila + lectura de locked_points
    SELECT points, locked_points INTO current_bal, v_locked
    FROM public.balances
    WHERE user_id = target_user_id
    FOR UPDATE;

    -- Gate M1: solo es retirable lo que supera el bono bloqueado.
    -- error_message = CÓDIGO 'wagering_locked' si el bloqueo es por bono; 'insufficient_balance' si simplemente no hay saldo.
    IF current_bal IS NULL OR (current_bal - COALESCE(v_locked, 0)) < amount_points THEN
        IF COALESCE(v_locked, 0) > 0 THEN
            RETURN QUERY SELECT FALSE, NULL::UUID, COALESCE(current_bal, 0), 'wagering_locked';
        ELSE
            RETURN QUERY SELECT FALSE, NULL::UUID, COALESCE(current_bal, 0), 'insufficient_balance';
        END IF;
        RETURN;
    END IF;

    INSERT INTO public.withdrawals (user_id, points, wallet_destination, status)
    VALUES (target_user_id, amount_points, dest_wallet, v_status)
    RETURNING id INTO new_withdrawal_id;

    -- Restar de points (locked_points no cambia: el retiro consume saldo retirable).
    UPDATE public.balances
    SET points = points - amount_points,
        updated_at = now()
    WHERE user_id = target_user_id
    RETURNING points INTO current_bal;

    RETURN QUERY SELECT TRUE, new_withdrawal_id, current_bal, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Settings por defecto (no pisar si ya existen)
INSERT INTO public.site_settings (key, value, updated_at)
VALUES
  ('WAGERING_MULTIPLIER', to_jsonb(20), now()),
  ('WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS', to_jsonb(500), now())
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Smoke test SQL (en Supabase SQL editor o psql de staging)**

Pega y ejecuta este bloque contra una BD de staging para validar el flujo completo en una transacción que se revierte:

```sql
BEGIN;
-- usuario de prueba
INSERT INTO public.balances (user_id, points) VALUES ('00000000-0000-0000-0000-000000000999', 0)
  ON CONFLICT (user_id) DO UPDATE SET points = 0, locked_points = 0, wagering_remaining = 0;

-- acreditar bono 100 con mult 20
SELECT * FROM public.credit_bonus_points('00000000-0000-0000-0000-000000000999', 100, 20);
-- esperado: points=100, locked=100, wagering=2000
SELECT points, locked_points, wagering_remaining FROM public.balances WHERE user_id='00000000-0000-0000-0000-000000000999';

-- intentar retirar 50 -> debe FALLAR (retirable=0)
SELECT success, error_message FROM public.create_withdrawal_request('00000000-0000-0000-0000-000000000999', 50, 'TestWalletAddrxxxxxxxxxxxxxxxxxxxxx');

-- apostar 2000 en hi-lo (descuenta de points y limpia lock al llegar wagering a 0)
SELECT * FROM public.place_hilo_bet('00000000-0000-0000-0000-000000000999', 100);
-- nota: points solo tiene 100, así que aquí simulamos saldo: subimos points para la prueba del lock
UPDATE public.balances SET points = 5000 WHERE user_id='00000000-0000-0000-0000-000000000999';
SELECT * FROM public.place_hilo_bet('00000000-0000-0000-0000-000000000999', 2000);
-- esperado tras apostar >= wagering: wagering=0, locked=0
SELECT points, locked_points, wagering_remaining FROM public.balances WHERE user_id='00000000-0000-0000-0000-000000000999';

-- ahora retirar debe FUNCIONAR
SELECT success, error_message FROM public.create_withdrawal_request('00000000-0000-0000-0000-000000000999', 50, 'TestWalletAddrxxxxxxxxxxxxxxxxxxxxx');
ROLLBACK;
```

Expected: el primer `create_withdrawal_request` devuelve `success=false` con el mensaje de saldo retirable; tras apostar, `wagering_remaining=0` y `locked_points=0`; el segundo retiro devuelve `success=true`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/039_wagering_locked_balance.sql
git commit -m "feat(db): migración 039 wagering (locked_points/wagering_remaining) + tope settings"
```

---

## Task 3: Wire `credit_bonus_points` en el faucet

**Files:**
- Modify: `src/app/api/faucet/route.ts:202-265`

- [ ] **Step 1: Leer el multiplicador y acreditar el payout vía bono**

En `POST`, sustituye el bloque que acredita el faucet con `atomic_add_points` (líneas ~202-212) por una lectura del multiplicador y la llamada al RPC de bono:

```ts
  // --- Update balance atomically (BONO: aplica wagering) ---
  const wagerMult = await getSetting<number>("WAGERING_MULTIPLIER", 20);
  const { data: addData, error: addError } = await supabase.rpc("credit_bonus_points", {
    p_user_id: userId,
    p_amount: payout,
    p_wager_mult: wagerMult,
  });

  if (addError || !addData?.[0]?.success) {
    return NextResponse.json({ error: "Error de servidor procesando los fondos. Intenta más tarde." }, { status: 500 });
  }

  const newPoints = Number(addData[0].result_balance);
```

- [ ] **Step 2: Acreditar la comisión de afiliado del faucet como bono**

En el bloque de comisión de afiliado (líneas ~248-253), cambia la acreditación de `atomic_add_points` a `credit_bonus_points` (la comisión también es dinero gratis y debe llevar wagering):

```ts
        if (commission > 0) {
          await supabase.rpc("credit_bonus_points", {
            p_user_id: ref.referrer_id,
            p_amount: commission,
            p_wager_mult: wagerMult,
          });

          await supabase.from("movements").insert({
            user_id: ref.referrer_id,
            type: "comision_afiliado",
            points: commission,
            reference: userId,
            metadata: { source: "faucet", referred_user: userId },
          });
        }
```

- [ ] **Step 3: Verificar typecheck/lint**

Run: `npm run lint`
Expected: sin errores nuevos en `faucet/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/faucet/route.ts
git commit -m "feat(faucet): acreditar faucet y comisión como bono con wagering"
```

---

## Task 4: Wire welcome points en el registro

**Files:**
- Modify: `src/app/api/auth/register/route.ts:258-265`

- [ ] **Step 1: Reemplazar el insert directo de WELCOME_POINTS por el RPC de bono**

`credit_bonus_points` hace `INSERT ... ON CONFLICT`, así que crea la fila del usuario nuevo. Sustituye:

```ts
  await supabase.from("balances").insert({ user_id: inserted.id, points: WELCOME_POINTS });
```

por:

```ts
  const wagerMult = await getSetting<number>("WAGERING_MULTIPLIER", 20);
  await supabase.rpc("credit_bonus_points", {
    p_user_id: inserted.id,
    p_amount: WELCOME_POINTS,
    p_wager_mult: wagerMult,
  });
```

(El `movements` insert de bienvenida que sigue se deja igual.)

- [ ] **Step 2: Verificar import de `getSetting`**

Confirma que `getSetting` está importado en el archivo (ya se usa para los rate-limits). Si no, añade: `import { getSetting } from "@/lib/site-settings";`

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat(register): welcome points como bono con wagering"
```

---

## Task 5: Wire bono de referido, comisiones de juego y recompensas de nivel

**Files:**
- Modify: `src/app/api/affiliates/route.ts:240-252`
- Modify: `src/app/api/predictions/bet/route.ts:154-160`
- Modify: `src/app/api/hi-lo/play/route.ts:319-325`
- Modify: `src/lib/levels.ts:264-279`

- [ ] **Step 1: Bono de referido verificado → bono con wagering**

En `affiliates/route.ts`, sustituye la acreditación del bono (líneas ~241-244):

```ts
  const wagerMult = await getSetting<number>("WAGERING_MULTIPLIER", 20);
  const { data: addData, error: addError } = await supabase.rpc("credit_bonus_points", {
    p_user_id: userId,
    p_amount: bonusAmount,
    p_wager_mult: wagerMult,
  });
```

(`getSetting` ya está importado en este archivo.)

- [ ] **Step 2: Comisión de juego (predicciones) → bono con wagering**

En `predictions/bet/route.ts`, dentro del bloque de comisión (línea ~157), cambia `atomic_add_points` por `credit_bonus_points`:

```ts
        const commission = Math.floor((amount * gameCommPercent) / 100);
        if (commission > 0) {
          const wagerMult = await getSetting<number>("WAGERING_MULTIPLIER", 20);
          await supabase.rpc("credit_bonus_points", {
            p_user_id: ref.referrer_id,
            p_amount: commission,
            p_wager_mult: wagerMult,
          });

          await supabase.from("movements").insert({
            user_id: ref.referrer_id,
            type: "comision_afiliado",
            points: commission,
            reference: user.id,
            metadata: { source: "prediction", referred_user: user.id, bet_amount: amount, round_id: roundData.id },
          });
        }
```

- [ ] **Step 3: Comisión de juego (HI-LO) → bono con wagering**

En `hi-lo/play/route.ts`, dentro de `finalTasks` (línea ~321), cambia la acreditación:

```ts
          const commission = Math.floor((bet * gameCommPercent) / 100);
          if (commission > 0) {
            const wagerMult = await getSetting<number>("WAGERING_MULTIPLIER", 20);
            await supabase.rpc("credit_bonus_points", { p_user_id: ref.referrer_id, p_amount: commission, p_wager_mult: wagerMult });
            await supabase.from("movements").insert({
              user_id: ref.referrer_id,
              type: "comision_afiliado",
              points: commission,
              reference: userId,
              metadata: { source: "hi_lo", referred_user: userId, bet_amount: bet },
            });
          }
```

(`getSetting` ya está importado en este archivo.)

- [ ] **Step 4: Recompensa de nivel → bono con wagering**

En `src/lib/levels.ts`, dentro de `checkAndNotifyLevelUp`, sustituye la acreditación de `rewardPoints` (línea ~266):

```ts
    try {
      const { getSetting } = await import("./site-settings");
      const wagerMult = await getSetting<number>("WAGERING_MULTIPLIER", 20);
      await supabase.rpc("credit_bonus_points", {
        p_user_id: userId,
        p_amount: currentLevel.rewardPoints,
        p_wager_mult: wagerMult,
      });

      await supabase.from("movements").insert({
        user_id: userId,
        type: "recompensa",
        points: currentLevel.rewardPoints,
        reference: `level_up_${currentLevel.level}`,
        metadata: { level: currentLevel.level, levelName: currentLevel.name, source: "level_up_reward" }
      });
```

- [ ] **Step 5: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos en los 4 archivos.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/affiliates/route.ts src/app/api/predictions/bet/route.ts src/app/api/hi-lo/play/route.ts src/lib/levels.ts
git commit -m "feat(bonos): referido, comisiones de juego y recompensas de nivel con wagering"
```

---

## Task 6: Retiro — mensaje M1 + tope global M2

**Files:**
- Modify: `src/app/api/withdraw/route.ts:211-218` (zona de `isAutoEligible`)

> M1 ya lo aplica el RPC (Task 2). Aquí: (a) mejorar el feedback cuando el RPC rechaza por retirable, (b) implementar el tope global usando `isGlobalCapReached` de `src/lib/wagering.ts`.

- [ ] **Step 1: Importar el helper del tope global**

Al principio de `withdraw/route.ts`, junto a los demás imports:

```ts
import { isGlobalCapReached } from "@/lib/wagering";
```

- [ ] **Step 2: Calcular pagado-hoy global y decidir el tope antes de `isAutoEligible`**

Justo antes de la línea `const isAutoEligible = ...` (línea ~217), inserta:

```ts
  // M2: presupuesto GLOBAL de pagos on-chain por día. Al superarlo, el retiro
  // queda en 'pending' (no auto-pago) en vez de drenar la reserva sin control.
  const dailyCapBolis = await getSetting<number>("WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS", 500);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { data: paidTodayRows } = await supabase
    .from("withdrawals")
    .select("points")
    .eq("status", "completed")
    .gte("processed_at", dayStart.toISOString());
  const paidBolisToday = (paidTodayRows ?? []).reduce((s, w) => s + Number(w.points), 0) / POINTS_PER_BOLIS;
  const globalCapReached = isGlobalCapReached({ paidBolisToday, thisBolis: bolisAmount, capBolis: dailyCapBolis });

  if (globalCapReached) {
    await logSecurityEvent({
      eventType: "withdrawal_global_cap_reached",
      userId,
      details: { paidBolisToday, thisBolis: bolisAmount, capBolis: dailyCapBolis },
      severity: "medium",
    }).catch(() => {});
  }
```

> Nota: `bolisAmount` se define más abajo en el código actual (`const bolisAmount = points / POINTS_PER_BOLIS;`). Mueve esa línea ARRIBA, justo después de leer `points`, para que esté disponible aquí. Verifica que no quede declarada dos veces.

- [ ] **Step 3: Incluir el tope global en `isAutoEligible`**

Modifica la condición de auto-elegibilidad (línea ~217) para excluir el caso de tope superado:

```ts
  const isAutoEligible = autoWithdrawGlobal === 1 && autoWithdrawUserLevel && points <= 100000 && !accountTooNew && !globalCapReached;
```

- [ ] **Step 4: Propagar el CÓDIGO del RPC (M1) — el frontend lo traduce**

El RPC ahora devuelve `error_message` como código estable (`wagering_locked`, `insufficient_balance`, `influencer_amount_exceeded`, `influencer_daily_limit`). Propágalo como `code` (líneas ~176-180):

```ts
  if (withdrawError || !withdrawData?.[0]?.success) {
    return NextResponse.json({
        code: withdrawData?.[0]?.error_message || "withdraw_failed",
        error: withdrawError?.message || "No se pudo procesar el retiro."
    }, { status: 400 });
  }
```

- [ ] **Step 5: Incluir `pendingReason` en la respuesta de éxito (para mensaje preciso)**

En el `return NextResponse.json({...})` final (línea ~298), añade el motivo de que quede pendiente para que el frontend muestre el texto correcto:

```ts
  return NextResponse.json({
    ok: true,
    withdrawalId: withdrawalId,
    balance: newBalance,
    autoProcessed: !!txHash,
    bolisAmount: bolisAmount,
    pendingReason: !txHash ? (globalCapReached ? "global_cap" : (accountTooNew ? "new_account" : "manual")) : null,
  });
```

- [ ] **Step 6: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos; `bolisAmount` declarado una sola vez.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/withdraw/route.ts
git commit -m "feat(withdraw): tope global (pending) + códigos de error y pendingReason"
```

---

## Task 7: UX — exponer retirable y wagering al usuario

**Files:**
- Modify: `src/app/api/faucet/route.ts` (GET, ~359-377)

> Mínimo viable: el GET del faucet ya devuelve el saldo; añadimos `withdrawable` y `wageringRemaining` para que la UI pueda mostrar "apuesta X para desbloquear". La integración visual concreta queda para la capa de UI; aquí garantizamos el dato.

- [ ] **Step 1: Leer locked/wagering en el GET y devolverlos**

En el `GET` de `faucet/route.ts`, cambia la consulta de balance para traer las columnas nuevas:

```ts
  const { data: balance } = await supabase
    .from("balances")
    .select("points, locked_points, wagering_remaining")
    .eq("user_id", userId)
    .single();
```

Y en el objeto de respuesta `NextResponse.json({...})`, añade:

```ts
    withdrawable: Math.max(0, Number(balance?.points ?? 0) - Number(balance?.locked_points ?? 0)),
    wageringRemaining: Number(balance?.wagering_remaining ?? 0),
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/faucet/route.ts
git commit -m "feat(ux): exponer saldo retirable y wagering pendiente en faucet GET"
```

---

## Task 8: Admin settings + bump de versión

**Files:**
- Modify: `src/app/admin/configuracion/page.tsx`
- Modify: `package.json`, `src/lib/version.ts`

- [ ] **Step 1: Exponer los dos settings en el panel admin**

En `src/app/admin/configuracion/page.tsx`, añade en la sección de seguridad/retiros dos campos editables ligados a las claves `WAGERING_MULTIPLIER` (entero, default 20) y `WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS` (entero, default 500). Sigue el patrón existente de los demás settings numéricos de esa página (mismo componente/handler que `WITHDRAW_RATE_MAX`).

- [ ] **Step 2: Bump de versión**

En `src/lib/version.ts`:

```ts
export const APP_VERSION = "1.163.0";
```

Y actualiza el campo `version` en `package.json` a `1.163.0`.

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK, sin errores de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/configuracion/page.tsx src/lib/version.ts package.json
git commit -m "chore(release): v1.163.0 (wagering + tope global de retiros) + settings admin"
```

---

## Task 9: Códigos estables en TODAS las respuestas de la ruta de retiro

**Files:**
- Modify: `src/app/api/withdraw/route.ts` (todas las respuestas de error/éxito)

> Objetivo: que cada regla devuelva un `code` estable (+ `params` cuando lleva números) en vez de solo texto español. El frontend (Task 10) lo traduce a es/en. Mantenemos `error` en español como fallback.

Mapa de respuestas → código:

| Caso | HTTP | code | params |
|---|---|---|---|
| No autorizado | 401 | `unauthorized` | — |
| Cuenta suspendida/bloqueada | 403 | `account_blocked` | — |
| Rate-limit (in-mem y persistente) | 429 | `rate_limit` | `[minutos]` |
| Retiros deshabilitados | 503 | `withdrawals_disabled` | — |
| Datos inválidos / mínimo | 400 | `invalid_data` | `[minPuntos]` |
| Nivel sin derecho a retiro | 403 | `level_no_withdraw` | — |
| Nivel: máximo por solicitud | 400 | `level_max` | `[nivel, bolis, puntos]` |
| Wallet inválida | 400 | `invalid_wallet` | — |
| Wallet ya usada por otro | 403 | `wallet_reused` | — |
| Frecuencia alta (≥3/24h) | 403 | `frequency_blocked` | — |
| RPC: wagering / saldo / influencer | 400 | (viene del RPC) | — |

- [ ] **Step 1: Añadir `code` (+ `params`) a cada respuesta de error**

Edita cada `NextResponse.json` de error en `withdraw/route.ts` para incluir el código. Versiones exactas:

```ts
// No autorizado
return NextResponse.json({ code: "unauthorized", error: "No autorizado." }, { status: 401 });

// Cuenta bloqueada
return NextResponse.json({ code: "account_blocked", error: "Tu cuenta está suspendida o bloqueada." }, { status: 403 });

// Rate-limit in-memory
return NextResponse.json({ code: "rate_limit", params: [Math.ceil(inMemRetry / 60)], error: `Demasiadas solicitudes de retiro. Espera ${Math.ceil(inMemRetry / 60)} minuto(s).` }, { status: 429 });

// Rate-limit persistente
return NextResponse.json({ code: "rate_limit", params: [Math.ceil(persRetry / 60)], error: `Demasiadas solicitudes de retiro. Espera ${Math.ceil(persRetry / 60)} minuto(s).` }, { status: 429 });

// Retiros deshabilitados
return NextResponse.json({ code: "withdrawals_disabled", error: "Los retiros se encuentran temporalmente deshabilitados por mantenimiento o seguridad. Inténtalo más tarde." }, { status: 503 });

// Datos inválidos
return NextResponse.json({ code: "invalid_data", params: [MIN_WITHDRAW_POINTS.toLocaleString()], error: `Datos inválidos. Mínimo ${MIN_WITHDRAW_POINTS.toLocaleString()} puntos.` }, { status: 400 });

// Nivel sin derecho a retiro
return NextResponse.json({ code: "level_no_withdraw", error: `El nivel ${userLevel.icon} ${userLevel.name} no tiene derecho a retiro. Sube al nivel Jugador para desbloquear los retiros (mínimo 10,000 puntos).` }, { status: 403 });

// Nivel: máximo por solicitud
return NextResponse.json({ code: "level_max", params: [userLevel.name, maxWithdrawBolis, (maxWithdrawBolis * POINTS_PER_BOLIS).toLocaleString()], error: `Tu nivel (${userLevel.name}) permite un retiro máximo de ${maxWithdrawBolis} BOLIS (${(maxWithdrawBolis * POINTS_PER_BOLIS).toLocaleString()} puntos) por solicitud.` }, { status: 400 });

// Wallet inválida
return NextResponse.json({ code: "invalid_wallet", error: "La dirección introducida no es una billetera válida de la red Solana. Por favor, revísala." }, { status: 400 });

// Wallet ya usada por otro
return NextResponse.json({ code: "wallet_reused", error: "Esta billetera protegida ya fue utilizada por otro usuario. Por reglas Anti-Fraude, debes usar una billetera de Solana única y personal." }, { status: 403 });

// Frecuencia alta
return NextResponse.json({ code: "frequency_blocked", error: "Tu solicitud de retiro ha sido bloqueada temporalmente por seguridad debido a la alta frecuencia de retiros en las últimas 24 horas. Por favor, contacta con soporte." }, { status: 403 });
```

(La respuesta del RPC ya lleva `code` por Task 6 Step 4. La de éxito ya lleva `pendingReason` por Task 6 Step 5.)

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/withdraw/route.ts
git commit -m "feat(withdraw): códigos estables en todas las respuestas para i18n"
```

---

## Task 10: i18n bilingüe (es/en) + traducción en el frontend

**Files:**
- Modify: `src/i18n/es.json` (objeto `withdraw` + nuevo objeto `wagering`)
- Modify: `src/i18n/en.json` (mismas claves)
- Modify: `src/app/cuenta/retirar/page.tsx` (traducir por `code`/`pendingReason`)

- [ ] **Step 1: Añadir claves al objeto `withdraw` de `src/i18n/es.json`**

Dentro del objeto `"withdraw": { ... }` (antes del cierre `}` en la línea ~712, tras `"invalid_wallet_solana"`), añade:

```json
    "err_unauthorized": "No autorizado.",
    "err_account_blocked": "Tu cuenta está suspendida o bloqueada.",
    "err_rate_limit": "Demasiadas solicitudes de retiro. Espera {0} minuto(s).",
    "err_withdrawals_disabled": "Los retiros están temporalmente deshabilitados por mantenimiento o seguridad. Inténtalo más tarde.",
    "err_invalid_data": "Datos inválidos. El mínimo de retiro es {0} puntos.",
    "err_level_no_withdraw": "Tu nivel aún no tiene derecho a retiro. Sube al nivel Jugador (🥇) para desbloquear los retiros.",
    "err_level_max": "Tu nivel ({0}) permite un retiro máximo de {1} BOLIS ({2} puntos) por solicitud.",
    "err_invalid_wallet": "La dirección no es una billetera válida de la red Solana. Revísala.",
    "err_wallet_reused": "Esta billetera ya fue utilizada por otra cuenta. Por reglas anti-fraude, usa una billetera de Solana única y personal.",
    "err_frequency_blocked": "Retiro bloqueado temporalmente por la alta frecuencia de retiros en las últimas 24 horas. Contacta con soporte.",
    "err_wagering_locked": "Saldo retirable insuficiente: aún tienes bono por desbloquear. Apuesta para completar el requisito de juego y poder retirar.",
    "err_insufficient_balance": "Saldo insuficiente para este retiro.",
    "err_influencer_amount_exceeded": "El monto supera el límite permitido para tu cuenta.",
    "err_influencer_daily_limit": "Has alcanzado el límite de retiros diarios de tu cuenta.",
    "err_withdraw_failed": "No se pudo procesar el retiro. Inténtalo más tarde.",
    "pending_global_cap": "Retiro solicitado. Por la alta demanda de pagos de hoy, se procesará manualmente en breve.",
    "pending_new_account": "Retiro solicitado. Por ser una cuenta reciente, se revisará manualmente antes del pago.",
    "pending_manual": "Retiro solicitado correctamente. Se procesará pronto desde administración."
```

- [ ] **Step 2: Añadir el objeto `wagering` a `src/i18n/es.json`**

Como entrada de nivel superior (junto a `"withdraw": {...}`):

```json
  "wagering": {
    "withdrawable": "Retirable",
    "locked_bonus": "Bono bloqueado",
    "unlock_progress": "Apuesta {0} fichas más para desbloquear tus retiros.",
    "fully_unlocked": "¡Saldo desbloqueado! Ya puedes retirar.",
    "explainer": "Las fichas de bono (faucet, bienvenida, comisiones) deben apostarse {0}× antes de poder retirarse. Los depósitos se retiran al instante."
  },
```

- [ ] **Step 3: Añadir las MISMAS claves a `src/i18n/en.json`**

Dentro del objeto `"withdraw"` de `en.json`:

```json
    "err_unauthorized": "Not authorized.",
    "err_account_blocked": "Your account is suspended or blocked.",
    "err_rate_limit": "Too many withdrawal requests. Wait {0} minute(s).",
    "err_withdrawals_disabled": "Withdrawals are temporarily disabled for maintenance or security. Try again later.",
    "err_invalid_data": "Invalid data. The minimum withdrawal is {0} points.",
    "err_level_no_withdraw": "Your level can't withdraw yet. Reach Player level (🥇) to unlock withdrawals.",
    "err_level_max": "Your level ({0}) allows a maximum withdrawal of {1} BOLIS ({2} points) per request.",
    "err_invalid_wallet": "The address is not a valid Solana wallet. Please check it.",
    "err_wallet_reused": "This wallet was already used by another account. Anti-fraud rules require a unique, personal Solana wallet.",
    "err_frequency_blocked": "Withdrawal temporarily blocked due to high withdrawal frequency in the last 24 hours. Please contact support.",
    "err_wagering_locked": "Not enough withdrawable balance: you still have bonus to unlock. Place bets to complete the wagering requirement before withdrawing.",
    "err_insufficient_balance": "Insufficient balance for this withdrawal.",
    "err_influencer_amount_exceeded": "The amount exceeds the limit allowed for your account.",
    "err_influencer_daily_limit": "You have reached your account's daily withdrawal limit.",
    "err_withdraw_failed": "Could not process the withdrawal. Please try again later.",
    "pending_global_cap": "Withdrawal requested. Due to high payout demand today, it will be processed manually shortly.",
    "pending_new_account": "Withdrawal requested. As this is a recent account, it will be reviewed manually before payout.",
    "pending_manual": "Withdrawal requested successfully. It will be processed soon from admin."
```

Y el objeto `wagering` de nivel superior en `en.json`:

```json
  "wagering": {
    "withdrawable": "Withdrawable",
    "locked_bonus": "Locked bonus",
    "unlock_progress": "Wager {0} more chips to unlock your withdrawals.",
    "fully_unlocked": "Balance unlocked! You can withdraw now.",
    "explainer": "Bonus chips (faucet, welcome, commissions) must be wagered {0}× before they can be withdrawn. Deposits withdraw instantly."
  },
```

- [ ] **Step 4: Traducir por `code`/`pendingReason` en `retirar/page.tsx`**

Añade un helper arriba del componente (tras los imports) que convierte la respuesta del servidor en texto traducido:

```ts
function translateWithdrawResponse(
  t: (k: string) => string,
  data: { code?: string; params?: (string | number)[]; error?: string }
): string {
  if (!data.code) return data.error || t("withdraw.error_request");
  let msg = t(`withdraw.err_${data.code}`);
  if (msg === `withdraw.err_${data.code}`) return data.error || t("withdraw.error_request"); // sin clave: fallback ES
  (data.params ?? []).forEach((p, i) => { msg = msg.replace(`{${i}}`, String(p)); });
  return msg;
}
```

Sustituye el manejo de error tras el `fetch` (líneas ~80-90):

```ts
      if (!res.ok) {
        setError(translateWithdrawResponse(t, data));
        return;
      }
      if (data.autoProcessed) {
        setMessage(t("withdraw.success_auto"));
      } else if (data.autoError) {
        setMessage(t("withdraw.error_auto_fail").replace("{0}", data.autoError));
      } else {
        const reason = data.pendingReason || "manual";
        setMessage(t(`withdraw.pending_${reason}`));
      }
```

- [ ] **Step 5: Verificar que ambos JSON son válidos y el build pasa**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/es.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/en.json','utf8')); console.log('JSON OK')"`
Expected: `JSON OK`

Run: `npm run build`
Expected: build OK.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/es.json src/i18n/en.json src/app/cuenta/retirar/page.tsx
git commit -m "feat(i18n): textos de retiro y wagering en español e inglés"
```

---

## Orden de despliegue (CRÍTICO)

1. **Aplicar la migración 039 ANTES del deploy** (patrón de `scripts/apply_migration_038*`/REST). Las rutas nuevas llaman a `credit_bonus_points` y leen `locked_points`; si el código sale antes que la migración, fallan.
2. Verificar con el smoke test SQL de Task 2 contra producción/staging.
3. Desplegar el código (Tasks 1, 3–8).
4. Confirmar settings `WAGERING_MULTIPLIER=20` y `WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS=500` presentes en `site_settings`.
5. **No hacer push sin OK del usuario.**

---

## Self-review (cobertura del spec)

- Modelo de datos (locked_points/wagering_remaining, invariante) → Task 1 (JS) + Task 2 (SQL). ✓
- Créditos que bloquean (faucet, welcome, comisiones, referido, nivel) → Tasks 3, 4, 5. ✓
- Depósito exento → no se toca (`atomic_add_points`), documentado en Task 2/spec. ✓
- Apuestas liberan wagering (hi-lo + predicciones) → Task 2 (RPCs). ✓
- Retiro valida retirable (M1) → Task 2 + Task 6 (mensaje). ✓
- Tope global (M2, pending) → Task 6. ✓
- Settings admin → Task 8. ✓
- UX wagering visible → Task 7. ✓
- Grandfather (default 0) → Task 2 Step 1. ✓
- Migración antes del deploy + bump versión → Orden de despliegue + Task 8. ✓
- Tests de la matemática pura → Task 1. ✓
- Textos informativos bilingües (es/en) de TODAS las reglas de retiro + wagering + pending → Task 9 (códigos) + Task 10 (claves es/en + traducción frontend). ✓
