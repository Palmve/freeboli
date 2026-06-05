// Test de correctitud del modelo de cuotas de Predicciones (corrección #1).
// El modelo debe pagar segun la probabilidad VERDADERA bajo martingala (CDF normal):
//   probUp = Φ( ln(P_now/P_start) / (σ·√T_left) ),  odds = (1/prob)·(1−edge)
// Propiedad clave: la probabilidad IMPLÍCITA en la cuota == Φ(z). Así NINGUNA estrategia
// (incluida "apostar lo que ya se movió") supera RTP 100%; el edge comunicado se mantiene.
// Importa el código REAL (Node 24 type-strip).
import assert from "node:assert/strict";
import { calculateDynamicOdds } from "../src/lib/price-oracle.ts";

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };
function normCdf(x){const t=1/(1+0.2316419*Math.abs(x));const d=0.3989422804014327*Math.exp(-x*x/2);let p=d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?1-p:p;}

const EDGE = 0.05;
const SIGMAS = { BTC: 0.0065, SOL: 0.012 };
const sigPerSec = (asset) => SIGMAS[asset] / Math.sqrt(3600);

// 1) Sin movimiento (P_now == P_start) => probUp = 0.5 => ambas cuotas = 2·(1−edge) = 1.90.
for (const asset of ["BTC", "SOL"]) {
  const oUp = calculateDynamicOdds("up", 100, 100, 1800, 3600, asset, EDGE);
  const oDown = calculateDynamicOdds("down", 100, 100, 1800, 3600, asset, EDGE);
  assert.equal(oUp, oDown, `${asset}: cuotas asimetricas sin movimiento`);
  assert.ok(Math.abs(oUp - 1.90) < 0.02, `${asset}: cuota sin movimiento ${oUp} != 1.90`);
}
ok("sin movimiento => oUp == oDown ≈ 1.90 (2·(1−edge))");

// 2) Probabilidad IMPLÍCITA en la cuota == Φ(z) (el corazón de la calibracion).
//    Probamos varios z lejos de los topes (clamp 1.05..cap) para evitar recortes.
let maxProbErr = 0;
for (const asset of ["BTC", "SOL"]) {
  for (const tLeft of [600, 1800, 3000]) {
    const s = sigPerSec(asset) * Math.sqrt(tLeft);
    for (const z of [-1.2, -0.6, -0.2, 0.2, 0.6, 1.2]) {
      const Pnow = 100 * Math.exp(z * s);
      const oUp = calculateDynamicOdds("up", 100, Pnow, tLeft, 3600, asset, EDGE);
      const impliedUp = (1 - EDGE) / oUp;           // prob implícita en la cuota
      const trueUp = normCdf(z);
      // dentro de los topes; toleramos el redondeo a 2 decimales de la cuota
      if (oUp > 1.06 && oUp < 9.9) maxProbErr = Math.max(maxProbErr, Math.abs(impliedUp - trueUp));
    }
  }
}
assert.ok(maxProbErr < 0.01, `prob implícita se aparta de Φ(z) hasta ${maxProbErr.toFixed(4)} (>1%)`);
ok(`prob implícita en la cuota == Φ(z) (error máx ${ (maxProbErr*100).toFixed(2) }%)`);

// 3) El favorito (lado que ya se movió) tiene cuota MENOR que el contrario, y la implícita
//    suma > 1 por el edge (overround), nunca a favor del jugador.
for (const asset of ["BTC", "SOL"]) {
  const Pnow = 100.3; // subió => UP es favorito
  const oUp = calculateDynamicOdds("up", 100, Pnow, 1800, 3600, asset, EDGE);
  const oDown = calculateDynamicOdds("down", 100, Pnow, 1800, 3600, asset, EDGE);
  assert.ok(oUp < oDown, `${asset}: favorito deberia tener cuota menor`);
  const overround = (1 - EDGE) / oUp + (1 - EDGE) / oDown; // ≈ Φ+ (1−Φ) = 1 (prob real)
  // la suma de prob implícitas reales ≈ 1; el margen de la casa está en (1−edge): RTP=prob·odds=1−edge
  assert.ok(overround > 0.98 && overround < 1.02, `${asset}: prob implícita total ${overround} fuera de ~1`);
}
ok("favorito con cuota menor; sin ventaja estructural para el jugador");

// 4) Cuota dentro de [1.05, cap]; respeta el cap configurable.
for (const cap of [10, 5, 30]) {
  const oLong = calculateDynamicOdds("down", 100, 110, 3300, 3600, "SOL", EDGE, cap);
  assert.ok(oLong <= cap + 1e-9, `cuota ${oLong} supera cap ${cap}`);
  assert.ok(oLong >= 1.05, `cuota ${oLong} bajo 1.05`);
}
ok("cuota dentro de [1.05, cap] y respeta cap configurable");

console.log(`\n✅ ${passed}/4 grupos de aserciones OK`);
