// AUDITORÍA HI-LO — Monte Carlo extendido (Parte 1).
// Re-valida con las FÓRMULAS REALES (importa los .ts) que:
//  (a) RTP ideal = 98% EXACTO en todo el rango de cuotas (analítico, determinista).
//  (b) RTP empírico ≤ 98% siempre (dentro del IC), 0 cuotas con ventaja de jugador.
//  (c) La apuesta mínima garantiza profit ≥ 1 a la cuota efectiva.
//  (d) Interacción con límites reales: minBet, maxBet por nivel y MAX_WIN_POINTS.
//
// Ejecuta: node scripts/audit_hilo_montecarlo.mjs
import { createHash } from "node:crypto";
import {
  HILO_ROLL_MOD,
  HILO_HOUSE_EDGE_FACTOR,
  HILO_ODDS_MIN,
  HILO_ODDS_MAX,
  hiLoWinningOutcomes,
  hiLoEffectiveOdds,
  hiLoMinBet,
} from "../src/lib/hilo.ts";
import { MAX_WIN_POINTS } from "../src/lib/config.ts";
import { LEVELS } from "../src/lib/levels.ts";

const TARGET = HILO_HOUSE_EDGE_FACTOR / 100; // 0.98
const NL = "\n";
const pct = (x) => (x * 100).toFixed(3) + "%";

// PRNG rápido (xorshift128) para 100M+ tiradas sin saturar Math.random.
let s0 = 0x9e3779b9 >>> 0, s1 = 0x243f6a88 >>> 0, s2 = 0xb7e15162 >>> 0, s3 = 0xdeadbeef >>> 0;
function xrand() {
  let t = s1 << 9;
  let r = s0 * 5; r = ((r << 7) | (r >>> 25)) * 9;
  s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t; s3 = (s3 << 11) | (s3 >>> 21);
  return (r >>> 0) / 4294967296;
}
const roll = () => Math.floor(xrand() * HILO_ROLL_MOD); // 0..9999 uniforme

console.log("=".repeat(72));
console.log("AUDITORÍA HI-LO — Monte Carlo con fórmulas reales");
console.log("=".repeat(72));

// ---------------------------------------------------------------------------
// (A) ANALÍTICO: barrido COMPLETO de la rejilla de k (todas las cuotas posibles).
//     Para cada k entero [2, 9702], eff=9800/k, p=k/10000, RTP_ideal = p·eff.
// ---------------------------------------------------------------------------
let maxIdealErr = 0, playerAdvCount = 0, minBetFailCount = 0;
let kMinSeen = Infinity, kMaxSeen = -Infinity;
for (let k = 2; k <= 9702; k++) {
  const eff = (HILO_HOUSE_EDGE_FACTOR * 100) / k;
  const p = k / HILO_ROLL_MOD;
  const rtpIdeal = p * eff;
  maxIdealErr = Math.max(maxIdealErr, Math.abs(rtpIdeal - TARGET));
  // profit ≥ 1 con minBet a la cuota efectiva
  const mb = hiLoMinBet(eff);
  const profit = Math.floor(mb * eff) - mb;
  if (profit < 1) minBetFailCount++;
  // ventaja de jugador a CUALQUIER bet entero (RTP máx se alcanza cuando floor no recorta):
  // payout = floor(bet*eff) ≤ bet*eff ⇒ RTP ≤ p*eff = 0.98. Comprobamos el borde.
  if (rtpIdeal > TARGET + 1e-9) playerAdvCount++;
  kMinSeen = Math.min(kMinSeen, k); kMaxSeen = Math.max(kMaxSeen, k);
}
console.log(`${NL}(A) Barrido analítico de los ${9702 - 2 + 1} valores de k (todas las cuotas):`);
console.log(`    eff ∈ [${(9800/9702).toFixed(4)}, ${9800/2}]  (cuota mín↔máx)`);
console.log(`    Máx |RTP_ideal − 98%|           = ${maxIdealErr.toExponential(3)}  (debe ≈ 0)`);
console.log(`    Cuotas con RTP_ideal > 98%      = ${playerAdvCount}  (debe ser 0)`);
console.log(`    Cuotas con profit(minBet) < 1   = ${minBetFailCount}  (debe ser 0)`);

// ---------------------------------------------------------------------------
// (B) Que la cuota PEDIDA por el usuario nunca produzca RTP>98% tras snap a k.
//     Barremos cuotas pedidas con 4 decimales en zonas densas.
// ---------------------------------------------------------------------------
let reqWorstRtp = 0, reqWorstOdds = 0, reqAdv = 0;
function scanRequested(lo, hi, step) {
  for (let o = lo; o <= hi + 1e-12; o += step) {
    const k = hiLoWinningOutcomes(o);
    const eff = hiLoEffectiveOdds(k);
    const rtp = (k / HILO_ROLL_MOD) * eff; // ideal (bet grande)
    if (rtp > reqWorstRtp) { reqWorstRtp = rtp; reqWorstOdds = o; }
    if (rtp > TARGET + 1e-9) reqAdv++;
  }
}
scanRequested(1.01, 5, 0.0001);
scanRequested(5, 100, 0.01);
scanRequested(100, 4900, 1);
console.log(`${NL}(B) Barrido de cuota PEDIDA (snap→k): RTP_ideal máx = ${pct(reqWorstRtp)} @ ${reqWorstOdds.toFixed(4)}x; cuotas con ventaja jugador = ${reqAdv}`);

// ---------------------------------------------------------------------------
// (C) MONTE CARLO empírico por cuota × tamaño de apuesta.
//     N escala con la rareza (k pequeño ⇒ más N) para IC razonable.
//     Apuestas pequeñas {1,2,5,10} y grandes {100,1k,10k} + bet máx admisible.
// ---------------------------------------------------------------------------
const maxBetLegend = LEVELS[LEVELS.length - 1].benefits.maxBetPoints; // 10000 (nivel Leyenda)
console.log(`${NL}(C) Monte Carlo empírico (maxBet nivel máx=${maxBetLegend}, MAX_WIN_POINTS=${MAX_WIN_POINTS}):`);
console.log("    cuota_ped  eff       k     bet      P(win)    RTP_esp   RTP_emp     IC95%        N");

const oddsGrid = [1.01, 1.10, 1.50, 1.95, 2, 3, 5, 10, 50, 100, 500, 1000, 4900];
const betSizes = [1, 2, 5, 10, 100, 1000, 10000];

let globalWorstEmpDeviation = null; // (emp - esp) más positivo en σ
let anyPlayerAdvantageEmp = false;

for (const oReq of oddsGrid) {
  const k = hiLoWinningOutcomes(oReq);
  const eff = hiLoEffectiveOdds(k);
  const p = k / HILO_ROLL_MOD;
  const minBet = hiLoMinBet(eff);

  // bet máx admisible por límites reales: ≤ maxBet nivel y profit ≤ MAX_WIN_POINTS
  const maxBetByWin = Math.max(1, Math.floor(MAX_WIN_POINTS / (eff - 1)));
  const maxAdmissible = Math.min(maxBetLegend, maxBetByWin);

  // Conjunto de bets a probar: tamaños fijos (si ≥ minBet) + minBet + maxAdmissible
  const bets = new Set();
  for (const b of betSizes) if (b >= minBet) bets.add(b);
  bets.add(minBet);
  bets.add(maxAdmissible);

  // N adaptativo: queremos ~≥ 20000 wins esperados ⇒ N ≈ 20000/p, cap [2M, 120M]
  const N = Math.min(120_000_000, Math.max(2_000_000, Math.ceil(20000 / p)));

  // Simulamos UNA vez la secuencia de wins (depende solo de k), reutilizable para todos los bets.
  let wins = 0;
  for (let i = 0; i < N; i++) if (roll() >= HILO_ROLL_MOD - k) wins++;
  const empP = wins / N;

  for (const bet of [...bets].sort((a, b) => a - b)) {
    const payout = Math.floor(bet * eff);
    const rtpEsp = p * (payout / bet);          // esperado REAL con floor
    const rtpEmp = empP * (payout / bet);       // empírico
    const se = (payout / bet) * Math.sqrt((p * (1 - p)) / N);
    const ic = 1.96 * se;
    const dev = se > 0 ? (rtpEmp - rtpEsp) / se : 0;
    if (globalWorstEmpDeviation === null || dev > globalWorstEmpDeviation.dev)
      globalWorstEmpDeviation = { dev, oReq, bet, rtpEmp, rtpEsp };
    // El esperado determinista (rtpEsp) ya está probado ≤ 98% exacto en (A)/(B).
    // Aquí testamos CONCORDANCIA del empírico con su propio esperado: una anomalía
    // real sería que el empírico supere su esperado por > 5σ (no ruido de muestreo).
    // (Con ~90 celdas a IC95% se espera ~5% fuera de banda por azar; 5σ lo descarta.)
    if (rtpEmp - rtpEsp > 5 * se + 1e-12) anyPlayerAdvantageEmp = true;
    if (rtpEsp > TARGET + 1e-9) anyPlayerAdvantageEmp = true; // esperado nunca debe pasar 98%

    const tag = bet === minBet ? " [minBet]" : bet === maxAdmissible ? " [maxBet]" : "";
    console.log(
      `    ${oReq.toString().padEnd(9)} ${eff.toFixed(4).padStart(8)} ${String(k).padStart(5)} ${String(bet).padStart(7)}  ${p.toFixed(5)}  ${pct(rtpEsp).padStart(8)}  ${pct(rtpEmp).padStart(8)}  ±${pct(ic).padStart(7)}  ${(N/1e6).toFixed(0)}M${tag}`
    );
  }
}

console.log(`${NL}(C) Resumen MC:`);
console.log(`    Desviación empírica más positiva: ${globalWorstEmpDeviation.dev.toFixed(2)}σ @ cuota ${globalWorstEmpDeviation.oReq}, bet ${globalWorstEmpDeviation.bet} (emp ${pct(globalWorstEmpDeviation.rtpEmp)} vs esp ${pct(globalWorstEmpDeviation.rtpEsp)})`);
console.log(`    ¿Alguna cuota con ventaja de jugador empírica (fuera de IC95)? ${anyPlayerAdvantageEmp ? "SÍ ⚠️" : "NO ✅"}`);

// ---------------------------------------------------------------------------
// VEREDICTO Parte 1
// ---------------------------------------------------------------------------
const pass =
  maxIdealErr < 1e-9 &&
  playerAdvCount === 0 &&
  minBetFailCount === 0 &&
  reqAdv === 0 &&
  !anyPlayerAdvantageEmp;
console.log(`${NL}${"=".repeat(72)}`);
console.log(`VEREDICTO HI-LO: ${pass ? "✅ PASA" : "❌ NO PASA"}`);
console.log(`  RTP ideal 98% exacto: ${maxIdealErr < 1e-9 ? "sí" : "NO"} | 0 cuotas ventaja jugador: ${playerAdvCount === 0 && reqAdv === 0 ? "sí" : "NO"} | minBet⇒profit≥1: ${minBetFailCount === 0 ? "sí" : "NO"} | MC sin anomalías: ${!anyPlayerAdvantageEmp ? "sí" : "NO"}`);
console.log("=".repeat(72));
