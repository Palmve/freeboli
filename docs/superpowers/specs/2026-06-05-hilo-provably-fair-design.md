# HI-LO Provably-Fair real (compromiso previo) — Diseño

**Fecha:** 2026-06-05 · **Item:** #2 de la auditoría de juegos · **Versión objetivo:** 1.155.0

## Problema
Hoy `playHiLo` genera `server_seed = randomHex(32)` en la misma request que la apuesta
y solo devuelve el hash *después*. No hay compromiso previo: el servidor conoce
`choice/odds/client_seed` antes de elegir la semilla y podría moler semillas perdedoras
(demostrado: ~5 intentos para forzar derrota a 49%). El verificador solo comprueba
`sha256(seed)==hash` a posteriori, lo que no prueba nada sin compromiso previo.

## Objetivo
Compromiso previo estilo Stake: `hash(server_seed)` visible **antes** de apostar;
`server_seed` secreta hasta que el jugador **rota** (entonces se revela y verifica su
historial). Resuelve también el #9 (nonce en BD, no derivado del conteo de movements).

**Cambio de UX aceptado:** una apuesta no se verifica al instante; se verifica tras rotar.

## Modelo de datos — `supabase/migrations/034_hilo_provably_fair.sql`
Tabla `public.hilo_seeds`:
- `id UUID PK`, `user_id UUID NOT NULL`
- `server_seed TEXT NOT NULL` (secreto; revelado solo al rotar)
- `server_seed_hash TEXT NOT NULL` (público desde el inicio)
- `client_seed TEXT NOT NULL` (editable mientras nonce==0)
- `nonce INTEGER NOT NULL DEFAULT 0`
- `active BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at TIMESTAMPTZ DEFAULT now()`, `revealed_at TIMESTAMPTZ`
- Índice único parcial: un solo activo por usuario `(user_id) WHERE active`.
- RLS habilitada **sin políticas para authenticated** → sin acceso directo del cliente;
  todo acceso vía API con service role (no filtrar `server_seed`).

### RPCs (`SECURITY DEFINER`, patrón de las migraciones 016/017)
- `ensure_hilo_seed(p_user_id UUID) RETURNS (id, server_seed_hash, client_seed, nonce)`:
  devuelve el seed activo creándolo si no existe (sin tocar nonce, sin revelar `server_seed`).
  Lo usa `GET /api/hi-lo/seed` para mostrar el compromiso antes de apostar.
- `set_hilo_client_seed(p_user_id UUID, p_client_seed TEXT) RETURNS (ok, message)`:
  fija `client_seed` del activo solo si `nonce==0`; si no, devuelve error.
- `next_hilo_nonce(p_user_id UUID) RETURNS (seed_id, server_seed, server_seed_hash, client_seed, nonce)`:
  `SELECT ... FOR UPDATE` del activo; si no existe lo crea (server_seed/hash/client_seed
  aleatorios, nonce 0); `nonce = nonce + 1`; devuelve la fila. Atómico → nonces únicos
  en apuestas concurrentes. La generación de aleatorios usa `gen_random_bytes` (pgcrypto)
  con `encode(...,'hex')`; hash con `digest(server_seed,'sha256')`.
- `rotate_hilo_seed(p_user_id UUID, p_new_client_seed TEXT DEFAULT NULL)
   RETURNS (revealed_server_seed, revealed_client_seed, revealed_nonce, new_server_seed_hash, new_client_seed)`:
  bloquea el activo, lo marca `active=FALSE, revealed_at=now()`, inserta uno nuevo activo
  (nonce 0; client_seed = `p_new_client_seed` o aleatorio); devuelve el revelado + el nuevo hash.

> **Decisión (revisada):** la `server_seed`/hash/`client_seed` se generan en **Node**
> (`crypto.randomBytes`, `hashServerSeed`) y se pasan al RPC como parámetros `p_new_*`,
> usados solo cuando hay que crear. Evita depender del esquema de `pgcrypto` en Supabase
> y reutiliza el hashing del verificador. La atomicidad (lock + nonce) sigue en el RPC.
>
> **Seguridad:** los RPC de semilla se llaman **solo con service role** (admin client) y se
> les `REVOKE EXECUTE ... FROM public, anon, authenticated`, para que un usuario no pueda
> invocar el RPC con el `p_user_id` de otro y leerle la `server_seed`. La API pasa siempre
> `currentUser.id`.

## Endpoints
| Ruta | Método | Qué hace |
|---|---|---|
| `/api/hi-lo/seed` | GET | `ensure_hilo_seed` → `{server_seed_hash, client_seed, nonce}`. Nunca `server_seed`. |
| `/api/hi-lo/seed/client` | POST | `set_hilo_client_seed` (solo si `nonce==0`). Validar string ≤64, imprimible. |
| `/api/hi-lo/seed/rotate` | POST | Llama `rotate_hilo_seed`; devuelve el seed revelado + el nuevo hash/client_seed. |

Todos: auth requerida, `isUserBlocked`, rate-limit ligero.

## Cambios en el juego
- `src/lib/hilo.ts`: extraer `settleHiLo(bet, choice, oddsRaw, roll)` **puro** que devuelve
  `{ win, payout, odds, effectiveOdds, k }` a partir de un `roll` dado. `playHiLo` lo reutiliza
  (genera seed propia; se mantiene para tests).
- `src/app/api/hi-lo/play/route.ts`:
  - Sustituir la generación de seed fresca por `supabase.rpc("next_hilo_nonce", { p_user_id })`.
  - `roll = rollFromSeeds(server_seed, client_seed, nonce)`; `settleHiLo(...)`.
  - Eliminar `nonce = count(apuesta_hi_lo)+1` (#9).
  - Metadata del movimiento: `{ choice, roll, win, payout, odds: eff, seed_id, server_seed_hash, client_seed, nonce }` — **sin `server_seed` en claro**.
  - Respuesta `verification`: `{ server_seed_hash, client_seed, nonce }` (hash ya comprometido).
- Verificador `/hi-lo/verificar`: **sin cambios**.

## UI — `src/app/hi-lo/page.tsx`
Panel provably-fair: `Server seed (hash)`, `Client seed` editable (deshabilitado si nonce>0),
`Nonce`, botón **Rotar** que muestra `server_seed` revelada + enlaces de verificación.
Carga vía `GET /api/hi-lo/seed`; refresca nonce tras cada apuesta.

## Pruebas (`scripts/hilo_pf.test.mjs`)
- `settleHiLo` determinista e idéntico a `playHiLo` para el mismo roll.
- `sha256(server_seed) === hash` (compromiso).
- `rollFromSeeds` reproducible y coincide con la fórmula del verificador cliente
  (uint32 big-endian de los primeros 4 bytes % 10000).
- Atomicidad del nonce: garantizada por `FOR UPDATE` (mismo patrón que `place_hilo_bet`),
  razonada; no testeable en unit sin BD.

## Orden de despliegue (memoria antifraude-remediacion)
1. Aplicar `034_hilo_provably_fair.sql` en Supabase **ANTES** del deploy.
2. Push del código (Vercel) tras confirmar la migración.
3. Bump a v1.155.0 (`package.json` + `src/lib/version.ts`).

## Fuera de alcance (YAGNI)
- Auto-rotación periódica (se descartó: rotación a demanda).
- Editar `client_seed` después de apostar (forzar rotación para cambiarlo).
- Provably-fair de Predicciones (item aparte).
