# Auditoría de abuso multi-cuenta (red-team) — Resultado

> Estado auditado: **v1.162.0**. Enfoque: adversario astuto con **múltiples cuentas (sybil) + juego manual**.
> Complementa la auditoría de matemática ya cerrada (ver `memory/auditoria-juegos-roadmap.md`).
> Todo lo afirmado está leído del código; las cifras son simulaciones con los parámetros por defecto.

## TL;DR (veredicto)

La matemática de los juegos está a favor de la casa y **no** es el problema. El problema es de **diseño de economía**:

1. **CRÍTICO — No hay requisito de depósito para retirar.** Las fichas gratis (faucet + bienvenida + recompensas de nivel) se convierten en **BOLIS on-chain reales** sin que el jugador arriesgue nunca dinero propio. `src/app/api/withdraw/route.ts` no comprueba historial de depósito en ningún punto.
2. **CRÍTICO — Casi todos los límites son POR-CUENTA y no hay tope GLOBAL de pagos.** Con N cuentas, el drenaje escala linealmente y nada en el servidor lo frena salvo el saldo de la Master Wallet.
3. **ALTO — El faucet es renta pura.** ~3.000–6.200 fichas/día/cuenta sin arriesgar nada, retirable una vez superada la verja de nivel.

El único freno real al sybil hoy es **1 email real distinto por cuenta** (dedup canónico) + **rotación de IP**. Ambos son baratos de superar para un atacante decidido.

---

## Parámetros leídos (defaults, `src/lib/config.ts` + `src/lib/levels.ts`)

| Constante | Valor | Ámbito |
|---|---|---|
| `WELCOME_POINTS` | 100 | por cuenta |
| `FAUCET_POINTS` | 100 base | por cuenta, cooldown 1h |
| Multiplicador racha horaria | hasta **3.0x** (racha ≥9) | por cuenta |
| Bonus racha diaria | hasta **+100%** (día ≥31) | por cuenta |
| `CAPTCHA_INTERVAL` | cada 4 reclamos | math captcha |
| `FAUCET_ENGAGEMENT_EVERY` | cada 10 reclamos | exige 1 HI-LO/24h |
| `REFERRAL_VERIFIED_BONUS` | 10.000 | por referido válido |
| `AFFILIATE_FAUCET_PERCENT` | 10% | comisión sobre faucet del referido |
| `AFFILIATE_GAME_PERCENT` | 2% | comisión sobre apuestas del referido |
| `MAX_DAILY_AFFILIATE_COMMISSION` | 5.000 | por cuenta/día |
| `REFERRAL_MIN_BETS` / `REFERRAL_MIN_DAYS` | 20 / 3 | requisitos del referido |
| `MAX_SESSIONS_PER_IP` | 3 | por IP |
| `MIN_WITHDRAW_POINTS` | 10.000 (=10 BOLIS) | por retiro |
| `AUTO_WITHDRAW_MIN_ACCOUNT_DAYS` | 3 | edad para auto-pago |
| Retiros bloqueados si | ≥3 retiros/24h | por cuenta |
| Auto-pago on-chain si | ≤100.000 pts | por retiro |
| `MAX_WIN_POINTS` / `MAX_DAILY_WIN_POINTS` | 100k / 1M | por cuenta |
| Reserva de la casa | **10.000 BOLIS = 10.000.000 fichas** | global |

**Verja de retiro por nivel** (`maxWithdrawBolis`):

| Nivel | Requisitos | maxWithdraw |
|---|---|---|
| 1 Novato | — | **0** (no retira) |
| 2 Aprendiz | email, 5 bets, 3 faucet | **0** (no retira) |
| 3 Jugador | email, 20 bets, 10 faucet, 1 día | **10 BOLIS** |
| 4 Veterano | 200 bets, 30 faucet, 10 pred, 3 días | 25 (+1.000 pts reward) |
| 5–7 | 1k–10k bets… | 50 / 100 / 250 |

---

## Vector 6 (CRÍTICO) — Ruta completa ficha-gratis → BOLIS retirable

Esta es la que sangra la caja. Traza punta a punta:

1. Registro → +100 (bienvenida), crédito inmediato e incondicional.
2. Verificar email (gratis, 1 clic en el enlace — `verify-email/route.ts`).
3. Faucet cada hora → renta pura (ver simulación abajo).
4. Llegar a **Nivel 3** (única verja real): 20 apuestas HI-LO + 10 reclamos faucet + 1 día. Las 20 apuestas pueden ser de **1 ficha** cada una (mínimo permitido) → coste esperado ≈ 0.
5. Esperar a que la cuenta tenga **3 días** (verja `AUTO_WITHDRAW_MIN_ACCOUNT_DAYS`) para auto-pago on-chain; antes va a revisión manual.
6. Retirar 10 BOLIS a una **wallet Solana única** (gratis de generar) → `sendBolisToWallet` paga desde la Master Wallet.

**No existe en `withdraw/route.ts` ni en el RPC `create_withdrawal_request` (`028_withdrawal_safety_rpc.sql`) ninguna comprobación de depósito previo.** El atacante nunca pone dinero. El esquema (`001_initial.sql`) tiene un **único** `balances.points` — no hay separación entre saldo de bonos y saldo retirable, ni campos `total_deposited`/`has_deposited`. 

> Dato revelador: la UI **dice** "Para poder retirar, deposita al menos…" (`es.json:663`, `cuenta/depositar/page.tsx:79`), pero **es sólo texto; el servidor no lo valida**. La intención de diseño existía; la comprobación nunca se implementó.

### Simulación de renta del faucet (por cuenta)

Reclamando cada hora (cooldown 1h, racha horaria sube a 3x en el reclamo 9):

```
Día 1 (24 reclamos, sin bonus diario):
  2×100 + 2×150 + 2×200 + 2×250 + 16×300 = 6.200 fichas/día (cadencia perfecta)
Realista (12 reclamos/día, racha media ~2x): ~3.000 fichas/día
Día 31+ (bonus diario +100%): hasta ~12.400 fichas/día en cadencia perfecta
```

→ **3.000–6.200 fichas/día/cuenta = 3–6 BOLIS/día**, retirable en tramos de 10 BOLIS. La verja de nivel/edad sólo retrasa el primer retiro ~3 días; después es renta continua.

### Escalado y riesgo de ruina (reserva = 10.000 BOLIS)

| N cuentas | Drenaje/día (realista) | Drenaje/día (cadencia perfecta) | Reserva agotada en |
|---|---|---|---|
| 10 | ~30 BOLIS | ~62 BOLIS | meses |
| 100 | ~300 BOLIS | ~620 BOLIS | **17–33 días** |
| 1000 | ~3.000 BOLIS | ~6.200 BOLIS | **1,6–3,3 días** |

**No hay tope global de pagos diarios**: el servidor sólo limita por cuenta (3 retiros/24h) y por nivel (10 BOLIS). El único freno físico es el saldo de la Master Wallet (que, si está fondeada para operar, se vacía).

**Veredicto: NO PASA.** Es la fuga real de la caja.

---

## Vector 1 — Bonos gratis por cuenta (sybil)

- **Bienvenida 100 + faucet** = lo cuantificado arriba. Renta retirable.
- **Recompensas de nivel** (`rewardPoints`): 0 hasta nivel 4. Nivel 4 = +1.000 pts pero exige **200 apuestas HI-LO** → a la práctica, 200×(coste de edge) y mucho tiempo; **no rentable** como farm puro (el reward < pérdida esperada si apuestas serio, y si apuestas 1 ficha tardas mucho). Niveles 5–7 requieren 1k–10k apuestas: irrelevante para sybil.
- **Captcha**: math captcha 1–20 (`captcha.ts`), trivial de resolver a mano cada 4 reclamos. No frena a un humano.
- **Engagement cada 10**: exige 1 apuesta HI-LO/24h → coste ≈ 0.

**Veredicto: NO PASA** (faucet+bienvenida). El reward de nivel sí está bien diseñado (gated por volumen).

---

## Vector 2 — Límites por-cuenta que se multiplican

- `MAX_WIN_POINTS` (100k), `MAX_DAILY_WIN_POINTS` (1M), `maxBetPoints` por nivel: **todos por-cuenta**. Con N cuentas se multiplican.
- Pero ojo: estos límites son de **ganancia de juego**, que está sujeta al edge de la casa. Repartir una estrategia entre N cuentas no cambia el EV: si el juego pierde para el jugador, perderlo en 100 cuentas sigue perdiendo. **No es vector de extracción por sí mismo.**
- El daño real de "por-cuenta" está en **faucet y retiro** (vectores 1 y 6), no en los caps de ganancia.

**Veredicto: PASA en cuanto a juego; el problema multi-cuenta vive en faucet/retiro.**

---

## Vector 3 — Colusión en juegos desde cuentas propias

- **Predicciones, lados opuestos**: con edge 7% y cuota probit, apostar up+down desde dos cuentas paga el edge en ambas → pérdida esperada neta ≈ -7% del total apostado. No neutraliza nada; no captura mispricing porque la σ viva EWMA reprecia. El tope de exposición (400k/lado/ronda) limita además el tamaño.
- Único ángulo teórico: si la cuota quedara **desactualizada** entre el cálculo y la confirmación, pero `getActiveRoundWithOdds` recalcula en cada apuesta y el cutoff cierra la ronda. Riesgo residual bajo.
- **HI-LO**: sin PvP, RNG provably-fair por semilla; no hay colusión posible.

**Veredicto: PASA.** La colusión tiene EV negativo tras los fixes de matemática.

---

## Vector 4 — Auto-referido / farming de afiliados

- **Bono verificado (10.000)**: protegido. `checkSameIPReferral` **bloquea** el pago si referente y referido comparten IP de registro, y el alta con misma IP marca la cuenta como `evaluar` + evento de seguridad (`register/route.ts`). Además exige referido con email verificado + 20 apuestas + 3 días. Anti-doble-pago por índice único.
  - **Hueco**: el bloqueo es **sólo por IP de registro idéntica**. Con rotación de IP (VPN/móvil) entre referente y referido, el bono de 10.000 **sí se paga**. Coste para el atacante: 1 IP extra + 20 apuestas de 1 ficha + 3 días por anillo. Es decir, 10.000 fichas (10 BOLIS) retirables por referido "real-ish".
- **Comisiones (faucet 10% / juego 2%)**: topadas a 5.000/día/cuenta (`affiliate-guard`). **Importante**: las comisiones **NO** pasan por `checkSameIPReferral` — sólo por el cap diario. Pero:
  - Comisión de faucet 10%: el referido genera faucet gratis y el referente cobra 10% extra → **es dinero nuevo de la nada** (no sale del referido, lo crea el sistema). Con muchos referidos tope 5.000/día retirables. Es un multiplicador del vector faucet.
  - Comisión de juego 2%: el referido apuesta sus propias fichas; HI-LO tiene edge 2% → wash; Predicciones edge 7% → pérdida. No es extracción, sólo redistribución con fricción.

**Veredicto: NO PASA del todo.** El bono verificado es esquivable con rotación de IP, y la **comisión de faucet (10%) es dinero creado** que amplifica el vector 1.

---

## Vector 5 — Evasión de controles

Inventario de lo que existe (es bastante, hay que reconocerlo):

- `MAX_SESSIONS_PER_IP=3`, propagación de ban por IP (alta bloqueada si la IP tiene cuenta suspendida/bloqueada).
- Rate-limit doble (in-memory + persistente) en register/faucet/withdraw/juegos.
- Turnstile (si hay clave) + math captcha; honeypot `_hp`; tiempo mínimo de formulario `_ts`.
- Dedup de email canónico (gmail dots/+tag, googlemail) + bloqueo de desechables (~43 dominios, `disposable-emails.ts`).
- Detección de win-rate anómalo, frecuencia de retiro, eventos de seguridad, alertas Telegram.
- Cuentas nuevas (<3 días) → retiro a revisión manual.

**Huecos para juego manual + rotación de IP:**
- Todo lo anterior se esquiva con **1 email real distinto + 1 IP distinta cada 3 cuentas**. Nada liga la identidad más allá de email+IP+wallet, y los tres son baratos/renovables.
- El captcha matemático es trivial a mano.
- El estado `evaluar` (alta sybil same-IP, o auto-asignado por 3+ flags en `admin/usuarios`) **no bloquea nada**: `isUserBlocked` sólo frena `suspendido`/`bloqueado`. Confirmado que faucet/withdraw/hi-lo/predictions usan `isUserBlocked` — una cuenta `evaluar` puede faucetear, jugar y **retirar** con normalidad hasta que un admin la revise a mano.
- **Dedup de email sólo cubre Gmail por completo.** El canonical elimina `+tag` en todos los proveedores, pero los **puntos** sólo se normalizan en gmail/googlemail. En Outlook/Yahoo/Proton, `a.b@outlook.com`, `ab@outlook.com`, `a.b.c@outlook.com` son **3 cuentas distintas** desde la misma bandeja real → multiplica identidades sybil sin coste de email nuevo.

**Veredicto: PARCIAL.** Buen arsenal anti-bot, pero diseñado contra automatización, no contra **humano paciente con muchas identidades**. El estado `evaluar` debería tener consecuencias automáticas.

---

## Top hallazgos ordenados por daño

| # | Hallazgo | Severidad | Retirable | Daño potencial |
|---|---|---|---|---|
| 1 | Retiro sin requisito de depósito: faucet/bonos → BOLIS on-chain | **CRÍTICO** | Sí | Reserva en 1,6–3,3 días con 1000 cuentas |
| 2 | Sin tope GLOBAL de pagos diarios (todo por-cuenta) | **CRÍTICO** | Sí | Escala lineal sin freno servidor |
| 3 | Faucet como renta pura sin wagering | **ALTO** | Sí | 3–6 BOLIS/día/cuenta |
| 4 | Comisión faucet 10% = dinero creado; bono verificado esquivable con IP rotada | **ALTO** | Sí | +10% sobre faucet + 10 BOLIS/anillo |
| 5 | Estado `evaluar` no tiene consecuencia automática (puede retirar) | **MEDIO** | Sí | Depende de respuesta del admin |
| 5b | Dedup de email sólo cubre Gmail (Outlook/Yahoo dots no) | **MEDIO** | Sí | N identidades por bandeja real |
| 6 | Caps de ganancia/ apuesta por-cuenta | BAJO | No (edge) | Redistribución, no fuga |
| 7 | Colusión en juegos | INFO | No | EV negativo |

---

## Mitigaciones (concretas, baratas, ordenadas por impacto)

### M1 — Wagering / requisito de depósito antes de retirar  *(mata vectores 1, 3-faucet, 6)*
Lo más eficaz y barato. Opciones (de menor a mayor fricción de UX):
- **a)** Sólo es retirable el saldo proveniente de **depósito + ganancias netas de juego sobre depósito**. Las fichas de faucet/bienvenida/comisión son **jugables pero no retirables** (separar `withdrawable_balance` de `bonus_balance`).
- **b)** Si se quiere mantener "free-to-earn": exigir un **requisito de apuesta (wagering)** del saldo de bonos, p. ej. apostar 20–50x el bono antes de que sea retirable. Como el edge es 2–7%, el wagering devuelve a la casa el valor del bono en expectativa.
- **c)** Mínimo: exigir **al menos 1 depósito verificado** (cualquier importe) en la cuenta antes de habilitar retiros. Sube el coste del sybil de "0 €" a "1 depósito real + KYC implícito de la wallet".
- **Coste UX**: medio para usuarios legítimos free-to-play; nulo para los que depositan. Recomiendo (a) o (b).

### M2 — Tope GLOBAL de pagos diarios  *(mata vector 2)*
Añadir en `withdraw/route.ts` un presupuesto diario global de retiros (suma de `withdrawals` completadas hoy) y un % máximo de la reserva pagable/día (p. ej. 2–5%). Al superarlo, los retiros pasan a **pending** (revisión manual) en vez de auto-pago. **Coste**: ~30 líneas + 1 setting. Impacto enorme: convierte un drenaje de 3 días en uno de meses y da tiempo de reacción.

### M3 — Consecuencia automática para `evaluar` y para anomalías  *(vector 5)*
- Las cuentas `evaluar` (y las marcadas por win-rate/ frecuencia) deberían **no auto-pagar** (forzar `pending`) y, opcionalmente, no faucetear hasta revisión. Cambiar `isUserBlocked` o añadir un `canAutoWithdraw(status)`. **Coste**: trivial.

### M4 — Endurecer afiliados  *(vector 4)*
- Comisión de faucet (dinero creado): bajarla o **eliminarla** (dejar sólo comisión sobre apuestas reales, que tiene fricción de edge). O ligarla a que el referido haya **depositado**.
- Bono verificado: añadir señales además de IP de registro: **device fingerprint**, ASN, wallet de retiro compartida, o exigir depósito del referido. La IP sola es insuficiente.
- **Coste**: bajo-medio.

### M5 — Subir coste del sybil (defensa en profundidad)  *(vectores 1, 5)*
- Verja de retiro: subir `maxWithdrawBolis` del nivel 3 a **0** y empezar a permitir retiro en nivel 4 (que ya exige 200 apuestas + 3 días) — encarece mucho cada identidad. O exigir depósito para desbloquear retiro (M1c).
- Device fingerprint en registro/faucet (no sólo IP+email).
- **Extender el canonical de puntos a Outlook/Hotmail/Live/Yahoo/iCloud** (no sólo Gmail) en `email-normalize.ts`. Coste: ~10 líneas. Cierra el hueco de `a.b@outlook.com`.
- **Coste**: medio (fingerprint), bajo (mover verja).

### Prioridad recomendada
**M1 + M2 primero** (cierran el 90% del daño con poco código). Luego M3, M4, M5.
Recordatorio operativo: migraciones ANTES del deploy, subir versión (`package.json` + `src/lib/version.ts`), y no hacer push sin tu OK.

---

## Notas de método
- Todo verificado en código (`config.ts`, `levels.ts`, `streaks.ts`, `faucet/route.ts`, `withdraw/route.ts`, `register/route.ts`, `affiliates/route.ts`, `affiliate-guard.ts`, `hi-lo/play/route.ts`, `predictions/bet/route.ts`, `captcha.ts`, `email-normalize.ts`, `current-user.ts`).
- Cifras de faucet calculadas con los tiers por defecto de `streaks.ts`. Si los settings de admin (`site_settings`) sobre-escriben estos valores en producción, recalcular con los reales.
- Pendiente de confirmar en runtime: saldo real de la Master Wallet y si `WITHDRAWAL_AUTO_APPROVE` está activo en producción (de estarlo, el vector 6 es explotable hoy; si está en `false`, todo va a manual y el riesgo baja a "carga de trabajo del admin").
