// Test de correctitud matemática HI-LO (#4): RTP 98% exacto + apuesta mínima.
// Importa el código REAL (Node 24 hace type-stripping de .ts).
import assert from "node:assert/strict";
import {
  HILO_ROLL_MOD,
  HILO_HOUSE_EDGE_FACTOR,
  hiLoWinningOutcomes,
  hiLoEffectiveOdds,
  hiLoMinBet,
  hiLoRuleThresholds,
  isPlayerWin,
  playHiLo,
} from "../src/lib/hilo.ts";

const TARGET = HILO_HOUSE_EDGE_FACTOR / 100; // 0.98
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

// 1) cuotaEfectiva(k) = 9800/k
for (const k of [2, 3, 10, 4900, 9702]) {
  assert.equal(hiLoEffectiveOdds(k), (HILO_HOUSE_EDGE_FACTOR * 100) / k);
}
ok("hiLoEffectiveOdds(k) === 9800/k");

// 2) RTP exacto 98% para apuesta grande (floor despreciable), todo el rango pedido
for (let c = 101; c <= 490000; c++) {
  const oReq = c / 100;
  const k = hiLoWinningOutcomes(oReq);
  const eff = hiLoEffectiveOdds(k);
  const rtpIdeal = (k / HILO_ROLL_MOD) * eff;
  assert.ok(Math.abs(rtpIdeal - TARGET) < 1e-9, `RTP ideal ${rtpIdeal} != 0.98 @ odds ${oReq}`);
}
ok("RTP ideal == 98.000% exacto en TODO el rango (489k cuotas)");

// 3) Nunca RTP > 100% ni profit < 1 con bet = minBet (barrido completo)
let worstRtp = 9, worstOdds = 0;
for (let c = 101; c <= 490000; c++) {
  const oReq = c / 100;
  const k = hiLoWinningOutcomes(oReq);
  const eff = hiLoEffectiveOdds(k);
  const minBet = hiLoMinBet(eff);
  const payout = Math.floor(minBet * eff);
  const rtpMin = (k / HILO_ROLL_MOD) * (payout / minBet);
  assert.ok(rtpMin <= TARGET + 1e-9, `RTP>98% @ odds ${oReq}: ${rtpMin}`);
  assert.ok(payout - minBet >= 1, `profit<1 @ odds ${oReq}: bet ${minBet} payout ${payout}`);
  if (rtpMin < worstRtp) { worstRtp = rtpMin; worstOdds = eff; }
}
ok(`0 cuotas con RTP>100%; profit>=1 siempre (peor RTP@minBet = ${(worstRtp*100).toFixed(2)}% @ ${worstOdds.toFixed(2)}x)`);

// 4) Clamp de k coherente con los topes de cuota
assert.equal(hiLoWinningOutcomes(4900), 2);
assert.equal(hiLoEffectiveOdds(2), 4900);
assert.ok(hiLoEffectiveOdds(hiLoWinningOutcomes(1.01)) >= 1.01);
ok("clamp k [2,9702] <-> cuota [1.01, 4900]");

// 5) hiLoRuleThresholds expone effectiveOdds y minBet coherentes
const th = hiLoRuleThresholds(1.95);
assert.ok(typeof th.effectiveOdds === "number" && th.effectiveOdds > 1);
assert.equal(th.minBet, hiLoMinBet(th.effectiveOdds));
assert.equal(th.k, hiLoWinningOutcomes(1.95));
ok("hiLoRuleThresholds devuelve {effectiveOdds, minBet} coherentes");

// 6) playHiLo paga con effectiveOdds y la retorna
const r = playHiLo(100, "hi", 2, "seed", 1);
assert.equal(r.effectiveOdds, hiLoEffectiveOdds(hiLoWinningOutcomes(2)));
assert.equal(r.payout, r.win ? Math.floor(100 * r.effectiveOdds) : 0);
ok("playHiLo expone effectiveOdds y paga floor(bet*effectiveOdds)");

// 7) Monte Carlo N=1.000.000: RTP empírico dentro del IC (5σ) alrededor de 98%.
//    El RTP exacto ya está probado analíticamente en (2); aquí validamos que la
//    simulación concuerda, usando un intervalo de confianza escalado por cuota
//    (a cuotas altas, k pequeño -> varianza enorme: el IC se ensancha correctamente).
function rng() { return Math.floor(Math.random() * 4294967296) % HILO_ROLL_MOD; }
const N = 1_000_000;
for (const oReq of [1.10, 1.95, 2, 5, 100, 4900]) {
  const k = hiLoWinningOutcomes(oReq);
  const eff = hiLoEffectiveOdds(k);
  const bet = Math.max(100, hiLoMinBet(eff)); // bet grande -> floor despreciable
  const payout = Math.floor(bet * eff);
  const p = k / HILO_ROLL_MOD;
  let wins = 0;
  for (let i = 0; i < N; i++) {
    if (rng() >= HILO_ROLL_MOD - k) wins++; // choice hi
  }
  const emp = (wins * payout) / (N * bet);
  // RTP esperado REAL de este (bet,eff): el floor del premio recorta vs 0.98.
  const expectedRtp = p * (payout / bet);
  // Error estándar del estimador = (payout/bet)·sqrt(p(1-p)/N)
  const se = (payout / bet) * Math.sqrt((p * (1 - p)) / N);
  const band = 5 * se;
  assert.ok(Math.abs(emp - expectedRtp) <= band, `RTP emp ${emp} fuera de 5σ (${band.toFixed(4)}) de ${expectedRtp} @ ${oReq}`);
  assert.ok(expectedRtp <= TARGET + 1e-9, `RTP esperado > 98% @ ${oReq}`);
  console.log(`    odds ${oReq} -> eff ${eff.toFixed(4)} bet ${bet} RTP_esp=${(expectedRtp*100).toFixed(2)}% RTP_emp=${(emp*100).toFixed(3)}% (±5σ=${(band*100).toFixed(2)}%)`);
}
ok("Monte Carlo 1M: RTP empírico concuerda con el esperado (≤98%) dentro de 5σ");

console.log(`\n✅ ${passed}/7 grupos de aserciones OK`);
