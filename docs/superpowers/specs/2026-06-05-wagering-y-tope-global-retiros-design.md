# Diseño: Wagering (M1) + Tope global de pagos (M2)

> Fecha: 2026-06-05 · Versión base: v1.162.0
> Origen: `docs/AUDITORIA_MULTICUENTA_RESULTADO.md` (hallazgos CRÍTICO #1 y #2).
> Objetivo doble: **cortar la fuga de la caja** (fichas gratis → BOLIS retirables sin arriesgar) **sin matar el funnel free-to-play** ("hay que poner a los usuarios a jugar").

## Resumen

Las fichas gratis (faucet, bienvenida, comisiones de afiliado, recompensas de nivel, bono de referido verificado) hoy se convierten en BOLIS on-chain sin que el jugador arriesgue nada, y nada limita el pago global diario. Este diseño introduce:

- **M1 — Wagering 20x:** los bonos son jugables pero NO retirables hasta haberlos apostado 20×. Los **depósitos** quedan exentos (retirables al instante). Como el edge de la casa es 2–7%, el wagering devuelve buena parte del bono a la casa en expectativa y obliga al usuario a jugar para desbloquear.
- **M2 — Tope global diario de pagos:** un presupuesto diario de BOLIS pagables on-chain (default 5% de la reserva = 500 BOLIS). Al superarlo, los retiros se aceptan pero quedan en `pending` (revisión/pago manual) en vez de auto-pago.

Decisiones cerradas con el usuario:
- Mecanismo M1: **wagering** (no saldo dual ni gate de depósito).
- Multiplicador: **20x**.
- Depósitos: **exentos** de wagering.
- M2 al superar: **pasar a `pending`** (no rechazar).
- M2 presupuesto: **5% de la reserva (~500 BOLIS/día)**, configurable.
- Usuarios existentes: **grandfather** — saldo actual 100% retirable (`locked_points = 0`); el wagering sólo aplica a bonos nuevos desde el deploy.

## Modelo de datos

Se mantiene un único saldo jugable y se añaden dos contadores a `balances`:

| Columna | Tipo | Default | Significado |
|---|---|---|---|
| `points` (existente) | BIGINT | — | Saldo total jugable. No cambia cómo se apuesta. |
| `locked_points` (NUEVO) | BIGINT | `0` | Principal de bono aún no liberado. |
| `wagering_remaining` (NUEVO) | BIGINT | `0` | Fichas que faltan por apostar para liberar el bono. |

**Invariante / regla de oro:**

```
retirable = max(0, points - locked_points)
```

Ventajas: sin tabla aparte, una sola fuente de verdad, fácil de razonar y difícil de romper. Las pérdidas de juego reducen `points` de forma natural; si `points < locked_points`, `retirable = 0` hasta que se limpie el lock.

## Comportamiento por flujo

### A) Créditos que BLOQUEAN (bono)

Aplica a: **faucet, bienvenida (welcome), comisión de afiliado (faucet + juego), recompensa de nivel (`rewardPoints`), bono de referido verificado.**

Al acreditar un bono de importe `B` con multiplicador `mult` (default 20):

```
points             += B
locked_points      += B
wagering_remaining += B * mult
```

Implementado por un RPC nuevo `credit_bonus_points(p_user_id, p_amount, p_wager_mult)` (atómico). Todos los call-sites de bono pasan a usarlo en lugar de `atomic_add_points` / inserts directos.

### B) Créditos que NO bloquean (cash)

Aplica a: **depósitos reales.** Siguen usando `atomic_add_points` (sólo `points += D`, sin tocar `locked`). Quedan inmediatamente retirables, incluso por encima de un bono bloqueado existente.

> Nota: los **premios de juego** (`premio_hi_lo`, payout de predicciones) se acreditan como hoy (`points += payout`, vía `atomic_add_hilo_prize` / RPC de la apuesta). No se marcan como bono aparte: "viajan" sobre el estado de lock vigente. Mientras haya `locked_points`, esos premios tampoco son retirables (lo cual es correcto: son ganancias de jugar dinero de bono). Al limpiarse el lock, todo el `points` pasa a retirable.

### C) Apuestas LIBERAN wagering

En `place_hilo_bet` y `place_prediction_bet`, al colocar una apuesta de importe `A`:

```
wagering_remaining = GREATEST(0, wagering_remaining - A)
IF wagering_remaining = 0 THEN
  locked_points = 0   -- bono liberado: todo el saldo pasa a retirable
END IF
```

El descuento cuenta **gane o pierda** el jugador (se aplica en la colocación, antes de conocer el resultado). Esto es lo que "pone a jugar": liberar un faucet de 100 exige apostar 2.000 fichas.

### D) Retiro (`withdraw/route.ts` + `create_withdrawal_request`)

1. **M1 (gate de wagering):** exigir `(points - locked_points) >= puntos_solicitados`. Si no se cumple, devolver 400 con mensaje claro:
   > "Para retirar necesitas apostar X fichas más y desbloquear tu saldo de bono."
   La validación de saldo retirable se hace **dentro del RPC** `create_withdrawal_request` (atómico, `FOR UPDATE`) para cerrar races; la ruta también lo comprueba antes para dar buen mensaje.

2. **M2 (tope global diario):** antes de marcar el retiro como auto-elegible, sumar los BOLIS ya **pagados hoy** (global, todos los usuarios: `withdrawals` con `status = 'completed'` y `processed_at` de hoy, o `tx_signature` no nula hoy). Si `pagado_hoy + bolis_de_este_retiro > tope_diario`:
   - El retiro se crea igual, pero `isAutoEligible = false` → queda en `pending`.
   - Se registra evento de seguridad `withdrawal_global_cap_reached` (severity medium) y, opcionalmente, alerta Telegram.
   - Respuesta al usuario: ok con `autoProcessed: false` (cobrará tras revisión).
   El tope se lee de `site_settings.WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS` (default 500).

## RPCs afectados

| RPC | Cambio |
|---|---|
| `credit_bonus_points(p_user_id, p_amount, p_wager_mult)` | **NUEVO.** `points += amount`, `locked_points += amount`, `wagering_remaining += amount*mult`. Devuelve `(success, result_balance)`. |
| `place_hilo_bet(p_user_id, p_amount)` | **MODIFICAR.** Tras descontar la apuesta: decrementar `wagering_remaining` y limpiar `locked_points` si llega a 0. |
| `place_prediction_bet(...)` | **MODIFICAR.** Igual que hi-lo: decrementar wagering + limpiar lock. |
| `create_withdrawal_request(target_user_id, amount_points, dest_wallet)` | **MODIFICAR.** Validar `(points - locked_points) >= amount_points` además del saldo. |
| `atomic_add_points` | **SIN CAMBIOS.** Se reserva para créditos cash (depósito). |
| `atomic_add_hilo_prize` | **SIN CAMBIOS.** El premio sube `points`; el lock se gestiona por el wagering de la apuesta. |

## Call-sites a migrar (de `atomic_add_points`/insert directo → `credit_bonus_points`)

- `src/app/api/faucet/route.ts` — payout del faucet (línea ~203) y comisión de afiliado faucet (línea ~250).
- `src/app/api/auth/register/route.ts` — `WELCOME_POINTS` (insert directo en `balances`, línea ~258) → debe inicializar `locked_points`/`wagering_remaining` del welcome.
- `src/app/api/affiliates/route.ts` — bono de referido verificado (línea ~241).
- `src/app/api/predictions/bet/route.ts` — comisión de afiliado de juego (línea ~157).
- `src/app/api/hi-lo/play/route.ts` — comisión de afiliado de juego (línea ~322).
- `src/lib/levels.ts` — `rewardPoints` por subida de nivel (línea ~266).

> El multiplicador se lee de `site_settings.WAGERING_MULTIPLIER` (default 20) en cada call-site (helper `getSetting`).

## Configuración nueva (`site_settings`, editable en admin)

| Clave | Default | Uso |
|---|---|---|
| `WAGERING_MULTIPLIER` | `20` | Veces que hay que apostar el bono para liberarlo. |
| `WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS` | `500` | Presupuesto global de pagos on-chain/día (5% de reserva). Superarlo → `pending`. |

Exponer ambos en `src/app/admin/configuracion/page.tsx` (sección de seguridad/retiros) para ajuste sin redeploy.

## UX (convierte el wagering en objetivo de juego)

- Los endpoints GET de `faucet/route.ts` y de cuenta devuelven `wageringRemaining` y `withdrawable` (= `points - locked_points`).
- La página de cuenta/retiro muestra una barra de progreso: "Apuesta X fichas más para desbloquear tus retiros" en vez de un muro silencioso.
- El error de retiro bloqueado por wagering incluye cuánto falta por apostar.

## Migración y rollout

1. Migración SQL (`supabase/migrations/039_wagering_locked_balance.sql`):
   - `ALTER TABLE balances ADD COLUMN locked_points BIGINT NOT NULL DEFAULT 0, ADD COLUMN wagering_remaining BIGINT NOT NULL DEFAULT 0;` (grandfather: existentes a 0).
   - `CREATE OR REPLACE FUNCTION credit_bonus_points(...)`.
   - `CREATE OR REPLACE FUNCTION place_hilo_bet(...)` (redefinir con decremento de wagering).
   - `CREATE OR REPLACE FUNCTION place_prediction_bet(...)` (idem).
   - `CREATE OR REPLACE FUNCTION create_withdrawal_request(...)` (validar retirable).
   - Insertar settings `WAGERING_MULTIPLIER`=20 y `WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS`=500 (ON CONFLICT DO NOTHING).
2. **Migración ANTES del deploy** (los call-sites nuevos dependen del RPC y columnas).
3. Bump de versión: `package.json` + `src/lib/version.ts`.
4. No hacer push sin OK del usuario.

## Estrategia de pruebas

- **TDD en helpers puros** (lógica de wagering aislada): acreditar bono bloquea (locked+=B, wagering+=B*mult); apostar libera (wagering-=A, lock=0 al llegar a 0); retirable = max(0, points-locked); depósito no bloquea.
- **Tope global:** dado `pagado_hoy` y `cap`, decidir auto vs pending; el límite por-cuenta (3/24h) sigue intacto.
- **Integración (si hay infra de DB de test):** los 4 RPCs end-to-end — bono→apuestas→retiro; depósito retirable inmediato; race de doble retiro respeta `points-locked`.
- **Regresión:** que el flujo normal de faucet/HI-LO/predicciones/retiro de un usuario que deposita siga funcionando sin fricción extra.

## Fuera de alcance (YAGNI)

- No se separa en tablas/ledgers múltiples (un solo `balances` con 2 contadores).
- No se aplica wagering a saldos existentes (grandfather).
- No se tocan M3/M4/M5 de la auditoría (estado `evaluar`, afiliados same-IP, dedup de email) — irán en un trabajo posterior.
- No se implementa KYC ni fingerprint de dispositivo aquí.

## Riesgos y mitigaciones

- **Bug de contabilidad = fuga de dinero.** Por eso toda mutación va en RPCs atómicos con `FOR UPDATE` y la invariante `retirable = max(0, points - locked_points)` es única y simple. Tests cubren los caminos.
- **Grandfather permite un último farmeo** de quien ya acumuló fichas gratis. Acotado por la verja de nivel/edad (3 días, nivel 3) y por M2 (tope global). Aceptado como trade-off de UX.
- **20x a edge 2% (HI-LO)** no neutraliza el bono al 100% en EV; el farmeo a escala se cierra por la combinación con M2 + verja de nivel + esfuerzo manual de miles de apuestas/cuenta. Si se observa abuso, subir `WAGERING_MULTIPLIER` desde admin sin redeploy.
