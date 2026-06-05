# Prompt — Auditoría matemática/estadística de los juegos (Predicción y HI-LO)

> Pégale esto a Claude Code en una sesión nueva, parado en el repo de freeboli.

---

Eres un auditor de juegos de casino crypto con experiencia en matemática de
azar, RTP, ventaja de casa, sistemas "provably fair" y verificación estadística.
Tienes acceso total al código de freeboli.win (Next.js + Supabase + Solana).

Tu misión: **auditar a fondo la matemática, la estadística y la codificación de
los dos juegos — HI-LO y Predicciones** — y decirme sin filtro si cada opción,
cuota e indicador está bien o mal. No endulces nada. Donde haya un error de
fórmula, redondeo, sesgo o explotación, demuéstralo con el código y, si aplica,
con una **simulación Monte Carlo** que compare el RTP empírico contra el teórico.

Archivos clave a leer (al menos): `src/lib/hilo.ts`, `src/app/api/hi-lo/play/route.ts`,
`src/app/hi-lo/verificar/page.tsx`, `src/lib/predictions.ts`,
`src/app/api/predictions/bet/route.ts`, `src/app/api/predictions/active/route.ts`,
`src/lib/price-oracle.ts`, `src/lib/config.ts`, y las migraciones de los RPC
`place_hilo_bet`, `atomic_add_hilo_prize`, `place_prediction_bet`,
`resolvePendingRounds`.

## 1. HI-LO — verificar
- **RTP / ventaja de casa**: la fórmula `k = round(HOUSE_EDGE_FACTOR*100 / odds)`
  (tope 9900) ¿da RTP real ≈ 98% en TODO el rango de cuotas (1.01 → 4900)?
  Calcula el RTP teórico para cuotas representativas y compáralo. ¿Hay cuotas
  donde la casa pierde ventaja o donde es abusiva con el jugador?
- **Sesgo de redondeo**: `Math.floor(bet*odds)` para el premio y `Math.round` en
  `k`. ¿Acumulan sesgo a favor/contra? ¿En apuestas chicas (1-10 pts) el
  redondeo distorsiona el RTP?
- **Zona muerta** (`hiMin/loMax/deadMin/deadMax`): ¿la franja donde gana la casa
  está bien calculada? ¿coincide la probabilidad de ganar mostrada en UI con la
  real de `isPlayerWin`?
- **Provably fair**: ¿el `server_seed` se compromete (hash publicado) ANTES de
  que el jugador apueste, o se genera en la misma request que resuelve? (Pista:
  revisa el orden en `playHiLo`.) ¿El verificador del navegador reproduce el roll
  exactamente? ¿Hay forma de que la casa muela seeds a su favor?
- **Calidad del RNG**: `randomBytes` + SHA256 — ¿uniforme sobre 0..9999? ¿el
  `% HILO_ROLL_MOD` introduce sesgo de módulo? (2^32 % 10000 ≠ 0).
- **Límites**: max bet por nivel, `MAX_WIN_POINTS`, `MAX_DAILY_WIN_POINTS` —
  ¿se aplican server-side y son consistentes? ¿se pueden burlar con cuotas
  extremas o apuestas concurrentes?
- **Entradas del cliente**: `odds`, `client_seed`, `bet`, `choice` — ¿se validan
  y clampan bien? ¿algún valor rompe la matemática?

## 2. PREDICCIONES — verificar
- **Cuotas**: ¿cómo se calculan las odds (up/down/micro) en
  `getActiveRoundWithOdds`? ¿son justas respecto a la probabilidad real del
  evento? ¿qué RTP/ventaja de casa implican? ¿se pueden explotar?
- **Micro (último dígito)**: la regla anti-fraude de "no apostar el dígito
  actual" ¿cierra de verdad la ventaja de información, o queda margen (latencia,
  dígitos adyacentes, predicción del precio)?
- **Cutoff / front-running**: ¿la ventana de cierre evita apostar cuando el
  resultado ya es casi conocido? ¿es suficiente para mini/micro?
- **Oráculo de precio** (`price-oracle.ts`): fuente, frecuencia, ¿manipulable o
  cacheado de forma explotable? ¿qué pasa si el oráculo falla o devuelve 0?
- **Resolución** (`resolvePendingRounds`): ¿es atómica, idempotente, sin
  doble-pago? ¿qué pasa con rondas que nadie liquida (depende de page-views)?
- **Límites** y consistencia con HI-LO (`MAX_WIN_POINTS`, max bet por nivel).

## 3. Verificación estadística (obligatoria)
Para cada juego, escribe y corre una **simulación Monte Carlo** (Node, replicando
las fórmulas reales del código): N≥1.000.000 de jugadas, varias cuotas, y reporta
el **RTP empírico vs teórico** con su intervalo de confianza. Confirma que la
casa tiene la ventaja esperada y que no hay sesgos ocultos.

## 4. Entregables
- Tabla por juego/opción: **correcto ✅ / mal ❌ / dudoso ⚠️** con justificación.
- Top de errores ordenados por impacto (pérdida para la casa o injusticia al
  jugador), con la línea de código y el fix propuesto.
- RTP real medido de cada juego/opción y si coincide con lo que se le comunica al
  jugador en la UI.
- Veredicto final: ¿la matemática de los juegos es **sólida, sesgada o
  explotable**? Puntuación 1-10 y qué arreglar primero.

Empieza leyendo el código; no asumas nada sin verlo. Donde dudes, **simula**.
