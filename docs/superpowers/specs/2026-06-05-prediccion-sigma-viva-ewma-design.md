# Spec — σ viva (EWMA) para el modelo de cuotas de Predicciones

**Fecha:** 2026-06-05
**Versión objetivo:** 1.162.0
**Estado previo:** v1.161.0 (modelo probit calibrado con σ FIJA por activo — `SIGMAS` en `price-oracle.ts`).

## 1. Problema

El fix v1.161.0 corrigió la **forma funcional** del modelo de cuotas de Predicciones
(probit `probUp = Φ(ln(P_now/P_start)/(σ·√T_left))`), eliminando el exploit del jugador
"momentum" cuando la σ está bien calibrada. Pero la σ es una **constante por activo**
(`BTC: 0.0065`, `SOL: 0.012`, desviación típica del % de cambio en 1h). Si la volatilidad
**real** se aparta ≥50% de esa constante, el modelo vuelve a ser explotable:

- σ_real **mayor** que la configurada ⇒ el modelo subestima las reversiones ⇒ infrapaga
  al favorito y **sobrepaga al lado improbable (longshot)** ⇒ un jugador sharp explota el
  lado con cap. La auditoría (`scripts/audit_predictions.mjs`) midió RTP de hasta **190–331%**
  en un solo lado a σ_real = 1.5×–3× de la configurada.

Atenuantes ya desplegados (red de seguridad, NO solución): cap de cuota 10x
(`PREDICTION_MAX_ODDS`) y tope de exposición por lado 400k (`PREDICTION_MAX_ROUND_PAYOUT_PER_SIDE`).

**Objetivo:** estimar σ de forma viva (realizada, EWMA) para mantener `σ_modelo ≈ σ_real`
y cerrar el riesgo de régimen de volatilidad, con una postura conservadora que nunca
quede por debajo del baseline histórico.

## 2. Requisitos

- **R1.** σ por activo (BTC, SOL) estimada de la volatilidad **realizada** reciente.
- **R2.** Fuente: **klines/velas horarias de exchange** (Binance primario, Coinbase fallback).
  Sin tabla nueva ni cron nuevo; reusa el patrón de `price-oracle.ts`.
- **R3.** **EWMA** de los retornos log horarios (λ≈0.97, ~33h de memoria efectiva).
- **R4.** Postura conservadora: `σ_usada = max(σ_EWMA, baseline)` (nunca por debajo del
  `SIGMAS` histórico) + cota de sanidad superior `σ ≤ baseline×4` (anti-dato-basura).
- **R5.** Edge de la casa 5% → **7%** (`PREDICTION_HOUSE_EDGE`) como colchón adicional.
- **R6.** **Degradación segura:** ante cualquier fallo (klines caído, setting ausente/viejo,
  σ fuera de cota), el sistema recae EXACTAMENTE en el comportamiento v1.161.0 (σ baseline),
  que ya es seguro.
- **R7.** Sin latencia de red en la ruta de apuesta: σ se **precalcula** en el cron horario
  y se **lee** de `site_settings`.
- **R8.** Unidades de σ idénticas a `SIGMAS` (desviación típica fraccional a 1h) → drop-in.

No-objetivos (YAGNI): σ separada para mini vs hourly (el modelo escala por `√T_left`);
mediana de σ de varias fuentes; λ/ventana configurables; tabla de muestreo propia.

## 3. Arquitectura y componentes

Unidades aisladas, con interfaz clara y testeables por separado:

### 3.1 `src/lib/volatility.ts` (cálculo puro)
- `ewmaSigmaFromCloses(closes: number[], lambda?: number): number | null`
  Cálculo **puro** de σ horaria por EWMA a partir de una serie de precios de cierre.
  Retorna `null` si hay < 30 retornos. **Testeable sin red** (serie inyectada).
- `computeRealizedSigma(asset): Promise<{ sigma: number; ok: boolean }>`
  Pide ~168 velas horarias (7 días) a Binance (fallback Coinbase), extrae cierres, llama a
  `ewmaSigmaFromCloses`, aplica la cota de sanidad `[baseline×0.5, baseline×4]`. `ok=false`
  si la fuente falla o hay datos insuficientes (entonces `sigma` = baseline, no se usa).
- Depende de: `fetch` (con timeout, patrón de `price-oracle.ts`), `SIGMAS` (baseline).

### 3.2 `updateLiveVolatility()` en `src/lib/cron-tasks.ts` (orquestación)
- Para BTC y SOL: `computeRealizedSigma`; si `ok`, upsert en `site_settings`:
  `PREDICTION_SIGMA_LIVE_<ASSET>` = σ y `PREDICTION_SIGMA_LIVE_<ASSET>_AT` = ISO timestamp.
  Si `!ok`, **no** sobrescribe (conserva el último valor bueno). Devuelve resumen.
- Llamada desde `src/app/api/cron/master/route.ts` como un paso más (try/catch aislado).
- Depende de: `volatility.ts`, admin Supabase client.

### 3.3 `getModelSigma(asset)` en `src/lib/predictions.ts` (lectura segura)
- Lee `PREDICTION_SIGMA_LIVE_<ASSET>` y `..._AT` vía `getSetting`.
- **Frescura:** si ausente o `_AT` > 3h → usa `baseline`.
- **Piso conservador:** `σ_usada = max(valor_leído, baseline)`.
- Devuelve un `number` (σ horaria). Depende de: `getSetting`, `SIGMAS`.

### 3.4 `calculateDynamicOdds` en `src/lib/price-oracle.ts` (modelo, puro)
- Nuevo parámetro opcional `sigmaOverride?: number`. Si viene, se usa en lugar de
  `SIGMAS[asset]` para derivar `sigPerSec`. `SIGMAS` permanece como baseline/fallback.
- Sin otros cambios de lógica; el escalado por duración sigue saliendo de `√T_left`.

### 3.5 `getActiveRoundWithOdds` en `src/lib/predictions.ts` (integración)
- Antes de calcular cuotas: `const sigma = await getModelSigma(round.asset)`.
- Pasa `sigma` como `sigmaOverride` a las dos llamadas de `calculateDynamicOdds`.
- `houseEdge` ya es configurable; su default sube a 0.07 (ver §5).

## 4. Flujo de datos

```
cron horario (master)
  └─ updateLiveVolatility()
       └─ computeRealizedSigma(asset)
            └─ klines horarias (Binance→Coinbase) → cierres → ewmaSigmaFromCloses → cota
       └─ upsert site_settings: PREDICTION_SIGMA_LIVE_<asset> (+ _AT)

apuesta / consulta de odds
  └─ getActiveRoundWithOdds(asset)
       └─ getModelSigma(asset)   [lee setting · frescura<3h · piso max(baseline)]
       └─ calculateDynamicOdds(..., houseEdge=0.07, maxOddsCap, sigmaOverride=σ)
```

## 5. Configuración / settings

| Key | Antes | Después | Nota |
|---|---|---|---|
| `PREDICTION_HOUSE_EDGE` | 0.05 | **0.07** | Default en `predictions.ts`, seed migración, editable admin |
| `PREDICTION_SIGMA_LIVE_BTC` | — | baseline 0.0065 (init) | Auto-gestionado por el cron; visible en admin |
| `PREDICTION_SIGMA_LIVE_BTC_AT` | — | timestamp | Frescura |
| `PREDICTION_SIGMA_LIVE_SOL` | — | baseline 0.012 (init) | Auto-gestionado por el cron |
| `PREDICTION_SIGMA_LIVE_SOL_AT` | — | timestamp | Frescura |

Migración **`038_prediction_live_volatility.sql`**: sube edge a 0.07 e inicializa los
`PREDICTION_SIGMA_LIVE_*` al baseline (para que la 1ª lectura, antes del 1er cron, funcione).

## 6. Manejo de errores (degradación segura — R6)

| Fallo | Comportamiento |
|---|---|
| klines (todas las fuentes) caen | `computeRealizedSigma.ok=false` → cron no sobrescribe; lectura usa último bueno o baseline |
| setting `_LIVE_*` ausente | `getModelSigma` → baseline |
| `_AT` > 3h (cron parado) | `getModelSigma` → baseline |
| σ fuera de `[baseline×0.5, baseline×4]` | clamp en `computeRealizedSigma` |
| σ_live < baseline | piso `max(baseline)` en `getModelSigma` |

En el límite, el sistema = v1.161.0 (σ fija), que ya pasó la auditoría de forma funcional.

## 7. Tests

- **`scripts/volatility.test.mjs`** (sin red, importa el `.ts` real):
  - `ewmaSigmaFromCloses` con serie sintética de σ conocida → coincide dentro de tolerancia.
  - Serie con < 30 retornos → `null`.
  - Monotonía: una serie más volátil produce σ mayor.
  - (Cota/clamp y piso `max(baseline)` se prueban en la capa que los aplica con valores inyectados.)
- **`scripts/predictions_odds.test.mjs`** (ya existe): sigue verde (el `sigmaOverride` por
  defecto = baseline reproduce el comportamiento actual).
- **`scripts/audit_predictions.mjs`**: con σ_real = σ_modelo, momentum/sharp ≈ 96% (con edge
  7% baja a ~94%); el objetivo del live-σ es mantenerse en esa fila segura.

## 8. Despliegue

1. Migración **038** ANTES del deploy (sube edge, inicializa σ live al baseline).
2. Deploy del código (versión **1.162.0**: `package.json` + `src/lib/version.ts`).
3. El primer tick del cron horario sustituye los σ init por los realizados.

## 9. Riesgos residuales tras esta mejora

- El escalado mini/hourly asume difusión √t; la microestructura intradía no es exactamente
  √t. Mitigado por el piso `max(baseline)`, el edge 7% y el cap 10x. Cuantificable a futuro
  con histórico intradía real.
- λ fijo (~0.97): un cambio de régimen muy abrupto tarda ~1 día en reflejarse del todo; el
  piso `max(baseline)` y el edge cubren el transitorio.
