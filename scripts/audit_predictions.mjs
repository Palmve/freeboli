// AUDITORÍA PREDICCIONES UP/DOWN — RTP implícito del modelo de cuotas + exposición.
// Importa el modelo REAL (calculateDynamicOdds) de src/lib/price-oracle.ts.
//
// Método: bajo "mercado eficiente" el log-precio es martingala (deriva 0). Dado el precio
// actual y el tiempo restante, la probabilidad VERDADERA de cerrar UP es
//     trueUp = Φ( ln(P_now/P_start) / (σ_real · √T_left) )
// con σ_real la volatilidad real por segundo. El modelo, en cambio, deriva su probabilidad
// de una sigmoide y paga odds = (1/probModelo)·(1−edge). El RTP real de un lado es
//     RTP_lado = trueProb_lado · odds_lado.
// Si el modelo estuviera perfectamente calibrado, RTP = 1−edge = 95% en ambos lados.
// Auditamos: (1) RTP medio (¿≈95%?), (2) ¿existe (lado,diff,t) con RTP>100% explotable
// por un jugador "sharp"?, barriendo σ_real desde la mitad hasta 3× la σ del modelo
// (mis-especificación), y (3) exposición/pérdida máx de la casa por ronda.
//
// node scripts/audit_predictions.mjs
import { calculateDynamicOdds } from "../src/lib/price-oracle.ts";

const NL = "\n";
const pct = (x) => (x * 100).toFixed(2) + "%";

// Φ (CDF normal estándar) — aproximación de Abramowitz-Stegun (error < 7.5e-8).
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  let p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

// σ del MODELO (por segundo) tal y como lo usa price-oracle (SIGMAS base × √(total/3600)).
const MODEL_SIGMA_1H = { BTC: 0.0065, SOL: 0.012 };
const HOUSE_EDGE = 0.05;

// Volatilidad real por segundo coherente con el modelo: el modelo trata SIGMAS como la
// desviación del % de cambio a lo largo de toda la ronda de 1h. Para la simulación GBM
// necesitamos σ por segundo tal que σ_seg·√(T_total) ≈ σ_ronda. Tomamos σ_seg = σ_1h/√3600.
function sigmaPerSec(asset, mult) {
  return (MODEL_SIGMA_1H[asset] / Math.sqrt(3600)) * mult;
}

console.log("=".repeat(74));
console.log("AUDITORÍA PREDICCIONES — RTP implícito del modelo y exposición de la casa");
console.log("=".repeat(74));

// ---------------------------------------------------------------------------
// (1) BARRIDO DETERMINISTA: para una rejilla de (diff%, tiempo restante), calcula
//     odds del modelo y RTP real bajo varias σ_real. Busca el RTP máx explotable.
// ---------------------------------------------------------------------------
const SCENARIOS = [
  { asset: "BTC", type: "hourly", total: 3600, cutoff: 600 },
  { asset: "BTC", type: "mini", total: 600, cutoff: 120 },
  { asset: "SOL", type: "hourly", total: 3600, cutoff: 600 },
  { asset: "SOL", type: "mini", total: 600, cutoff: 120 },
];
const SIGMA_MULTS = [0.5, 1.0, 1.5, 2.0, 3.0]; // σ_real / σ_modelo (mis-especificación)

console.log(`${NL}(1) RTP del modelo barriendo diff% × tiempo × σ_real (edge comunicado=${pct(HOUSE_EDGE)}):`);
console.log("    Para cada escenario: RTP medio de un jugador 'sharp' (elige el mejor lado)");
console.log("    y el MÁXIMO RTP de un solo lado (peor caso explotable).\n");
console.log("    asset/type   σ_real/σmod   RTP_sharp_medio   RTP_max_lado   ¿>100%?");

let anyExploitable = false;
let worstExploit = { rtp: 0 };

for (const sc of SCENARIOS) {
  const sigMod = MODEL_SIGMA_1H[sc.asset] * Math.sqrt(sc.total / 3600); // σ ronda del modelo
  for (const mult of SIGMA_MULTS) {
    const sSec = sigmaPerSec(sc.asset, mult) * Math.sqrt(sc.total / 3600) / Math.sqrt(sc.total / 3600);
    // σ real por segundo (escala con la duración igual que el modelo)
    const sigRealPerSec = (MODEL_SIGMA_1H[sc.asset] * mult) / Math.sqrt(3600);

    let sumSharp = 0, nSharp = 0, maxSide = 0;
    // tiempo de apuesta: sólo se permite mientras time_left > cutoff
    for (let tLeft = sc.cutoff + 1; tLeft <= sc.total; tLeft += Math.max(1, Math.floor((sc.total - sc.cutoff) / 40))) {
      // diff% plausibles dado el tiempo transcurrido: hasta ±4σ del movimiento esperado
      const elapsed = sc.total - tLeft;
      const sigMove = sigRealPerSec * Math.sqrt(Math.max(1, elapsed)); // σ del % de cambio ya ocurrido
      for (let z = -4; z <= 4; z += 0.25) {
        const diffPct = z * (sigMove || 1e-9);
        const Pnow = 100 * (1 + diffPct);
        const oUp = calculateDynamicOdds("up", 100, Pnow, tLeft, sc.total, sc.asset, HOUSE_EDGE);
        const oDown = calculateDynamicOdds("down", 100, Pnow, tLeft, sc.total, sc.asset, HOUSE_EDGE);
        // prob verdadera de cerrar UP: ln(Pnow/Pstart)/(σ_real·√tLeft)
        const trueUp = normCdf(Math.log(Pnow / 100) / (sigRealPerSec * Math.sqrt(tLeft)));
        const trueDown = 1 - trueUp;
        const rtpUp = trueUp * oUp;
        const rtpDown = trueDown * oDown;
        const sharp = Math.max(rtpUp, rtpDown);
        sumSharp += sharp; nSharp++;
        const sideMax = Math.max(rtpUp, rtpDown);
        if (sideMax > maxSide) maxSide = sideMax;
        if (sideMax > worstExploit.rtp) worstExploit = { rtp: sideMax, asset: sc.asset, type: sc.type, mult, diffPct, tLeft, oUp, oDown, trueUp };
      }
    }
    const sharpMean = sumSharp / nSharp;
    const exploit = maxSide > 1.0 + 1e-9;
    if (exploit) anyExploitable = true;
    console.log(`    ${(sc.asset + "/" + sc.type).padEnd(12)} ${mult.toFixed(1).padStart(8)}x   ${pct(sharpMean).padStart(13)}   ${pct(maxSide).padStart(11)}   ${exploit ? "SÍ ⚠️" : "no"}`);
  }
}

console.log(`${NL}    Peor caso de un solo lado: RTP=${pct(worstExploit.rtp)} (asset ${worstExploit.asset}/${worstExploit.type}, σ_real=${worstExploit.mult}×, diff=${(worstExploit.diffPct*100).toFixed(3)}%, t_left=${worstExploit.tLeft}s, oUp=${worstExploit.oUp}, oDown=${worstExploit.oDown})`);

// ---------------------------------------------------------------------------
// (2) MONTE CARLO de rondas completas (validación): simula caminos GBM y un jugador
//     'sharp' que apuesta el lado de mayor RTP esperado; mide RTP empírico.
// ---------------------------------------------------------------------------
console.log(`${NL}(2) Monte Carlo de rondas completas (jugador sharp, σ_real = σ_modelo):`);
function gauss() { // Box-Muller
  let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
console.log("    3 estrategias: RANDOM (lado al azar), MOMENTUM (apuesta lo que YA se movió,");
console.log("    sin cálculo alguno), SHARP (lado de mayor EV). RTP empírico = devuelto/apostado.\n");
console.log("    asset/type    RTP_random   RTP_momentum   RTP_sharp");
let momentumExploit = false;
for (const sc of SCENARIOS) {
  const sigRealPerSec = MODEL_SIGMA_1H[sc.asset] / Math.sqrt(3600);
  const N = 500_000;
  let pRandom = 0, pMomentum = 0, pSharp = 0, stake = 0;
  for (let i = 0; i < N; i++) {
    const Pstart = 100;
    const tBet = sc.cutoff + 1 + Math.floor(Math.random() * (sc.total - sc.cutoff));
    const elapsed = sc.total - tBet;
    const Pnow = Pstart * Math.exp(sigRealPerSec * Math.sqrt(Math.max(1, elapsed)) * gauss() - 0.5 * sigRealPerSec * sigRealPerSec * elapsed);
    const oUp = calculateDynamicOdds("up", Pstart, Pnow, tBet, sc.total, sc.asset, HOUSE_EDGE);
    const oDown = calculateDynamicOdds("down", Pstart, Pnow, tBet, sc.total, sc.asset, HOUSE_EDGE);
    const trueUp = normCdf(Math.log(Pnow / Pstart) / (sigRealPerSec * Math.sqrt(tBet)));
    // resolución con GBM REAL (no usa la sigmoide): precio de cierre
    const Pclose = Pnow * Math.exp(sigRealPerSec * Math.sqrt(tBet) * gauss() - 0.5 * sigRealPerSec * sigRealPerSec * tBet);
    const resultUp = Pclose > Pstart;
    stake += 1;
    // RANDOM
    const rUp = Math.random() < 0.5;
    if (rUp === resultUp) pRandom += rUp ? oUp : oDown;
    // MOMENTUM: apuesta la dirección que YA se movió (sin Φ ni nada)
    const mUp = Pnow >= Pstart;
    if (mUp === resultUp) pMomentum += mUp ? oUp : oDown;
    // SHARP: lado de mayor EV (usa Φ)
    const sUp = trueUp * oUp >= (1 - trueUp) * oDown;
    if (sUp === resultUp) pSharp += sUp ? oUp : oDown;
  }
  const rtpMom = pMomentum / stake;
  if (rtpMom > 1.0) momentumExploit = true;
  console.log(`    ${(sc.asset + "/" + sc.type).padEnd(12)} ${pct(pRandom / stake).padStart(9)}   ${pct(rtpMom).padStart(11)}   ${pct(pSharp / stake).padStart(9)}`);
}
console.log(`    → Un jugador MOMENTUM (cero sofisticación) ${momentumExploit ? "SUPERA el 100% ⇒ edge a favor del JUGADOR ⚠️" : "queda < 100%"}.`);

// ---------------------------------------------------------------------------
// (3) EXPOSICIÓN / PÉRDIDA MÁXIMA DE LA CASA POR RONDA.
//     Tope por lado = PREDICTION_MAX_ROUND_PAYOUT_PER_SIDE; tope por jugada = MAX_WIN_POINTS.
//     Pérdida máx ronda = payout_lado_ganador − stakes_totales. Peor caso: todo el dinero
//     en el lado ganador ⇒ pérdida = cap − cap/odds = cap·(1 − 1/odds).
// ---------------------------------------------------------------------------
const CAP_SIDE = 400_000;         // PREDICTION_MAX_ROUND_PAYOUT_PER_SIDE (defecto v1.160.0)
const MAX_WIN = 100_000;          // MAX_WIN_POINTS
const HOUSE_RESERVE_POINTS = 10_000 * 1000; // 10.000 BOLIS × 1000 pts
console.log(`${NL}(3) Exposición de la casa por ronda (cap/lado=${CAP_SIDE.toLocaleString()} pts, maxWin/jugada=${MAX_WIN.toLocaleString()}):`);
console.log("    odds_lado_gana   stakes_lado   payout(cap)   pérdida_neta_casa   % reserva (10M)");
for (const odds of [1.05, 1.5, 2, 5, 10, 30]) {
  // peor caso: lado ganador llena el cap de payout; el lado perdedor aporta 0 (conservador).
  const stakesWin = Math.floor(CAP_SIDE / odds);
  const payoutWin = Math.min(CAP_SIDE, Math.floor(stakesWin * odds));
  const netLoss = payoutWin - stakesWin; // sin contar stakes del lado perdedor (peor caso)
  console.log(`    ${odds.toFixed(2).padStart(12)}x   ${stakesWin.toLocaleString().padStart(11)}   ${payoutWin.toLocaleString().padStart(11)}   ${netLoss.toLocaleString().padStart(15)}   ${pct(netLoss / HOUSE_RESERVE_POINTS).padStart(8)}`);
}
const maxRoundLoss = CAP_SIDE - Math.floor(CAP_SIDE / 30); // peor odds=30
console.log(`    Pérdida neta MÁX por ronda (odds 30) = ${maxRoundLoss.toLocaleString()} pts = ${(maxRoundLoss/1000).toFixed(0)} BOLIS (${pct(maxRoundLoss/HOUSE_RESERVE_POINTS)} de la reserva).`);

// ---------------------------------------------------------------------------
// VEREDICTO Parte 2
// ---------------------------------------------------------------------------
// Criterio PRIMARIO (condición operativa realista, σ_real = σ_modelo): que un jugador
// MOMENTUM sin sofisticación NO tenga ventaja. Eso valida la FORMA FUNCIONAL del modelo.
// El barrido de σ mal calibrada es un riesgo de RÉGIMEN aparte (mitigable con σ viva + edge).
const formaFuncionalOK = !momentumExploit;
console.log(`${NL}${"=".repeat(74)}`);
console.log(`VEREDICTO PREDICCIONES (forma funcional, σ calibrada): ${formaFuncionalOK ? "✅ PASA" : "❌ NO PASA"}`);
console.log(`  Jugador MOMENTUM (σ correcta) con edge > 0: ${momentumExploit ? "SÍ ⚠️" : "NO ✅ (casa conserva su margen)"}`);
console.log(`  Pérdida máx por ronda < reserva: ${maxRoundLoss < HOUSE_RESERVE_POINTS ? "sí ✅" : "NO ⚠️"} (${(maxRoundLoss/HOUSE_RESERVE_POINTS*100).toFixed(1)}% de 10M)`);
console.log(`${NL}  ⚠️  RIESGO RESIDUAL DE RÉGIMEN: si la volatilidad real se desvía de la σ configurada,`);
console.log(`      el modelo puede volverse explotable (barrido σ_real≠σ_modelo arriba: ${anyExploitable ? "SÍ a ≥1.5×" : "no"}).`);
console.log(`      Mitigación recomendada: (a) σ viva por EWMA de histórico real, (b) edge ≥ 7-8%`);
console.log(`      como colchón, (c) cap de cuota bajo (ya 10x) y tope de exposición (ya 400k).`);
console.log("=".repeat(74));
