// AUDITORÍA DE LÍMITES — riesgo de ruina y drawdown de la banca (Parte 3).
// Banca = HOUSE_BOLIS_RESERVE (10.000 BOLIS = 10.000.000 fichas).
// Modela: (A) adversario relentless en HI-LO (peor varianza: apuesta para ganar MAX_WIN
// a la cuota más alta, con tope diario), (B) volumen agregado normal, (C) tabla de límites.
//
// node scripts/audit_limits_risk.mjs
import { hiLoWinningOutcomes, hiLoEffectiveOdds } from "../src/lib/hilo.ts";

const NL = "\n";
const pct = (x) => (x * 100).toFixed(2) + "%";
const fmt = (n) => Math.round(n).toLocaleString();

function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const RESERVE = 10_000_000; // 10.000 BOLIS × 1000 fichas

console.log("=".repeat(76));
console.log("AUDITORÍA DE LÍMITES — riesgo de ruina y drawdown (banca = 10.000.000 fichas)");
console.log("=".repeat(76));

// ===========================================================================
// (A) ADVERSARIO RELENTLESS HI-LO: estrategia de máxima varianza.
//     Cada jugada apuesta para ganar netos = MAX_WIN a la cuota efectiva = oddsAdv
//     (cuanto más alta, peor ratio varianza/edge). Para diversamente, probamos varias.
//     Tope diario MAX_DAILY: cuando el neto del día llega a +MAX_DAILY, el jugador para.
//     El jugador juega 'playsPerDay' como mucho. Simulamos 'days' días, 'sims' campañas.
// ===========================================================================
function simulateAdversary({ maxWin, maxDaily, oddsAdv, playsPerDay, days, sims, reserve }) {
  const k = hiLoWinningOutcomes(oddsAdv);
  const eff = hiLoEffectiveOdds(k);
  const p = k / 10000;                 // prob de que gane el jugador
  const stake = Math.max(1, Math.floor(maxWin / (eff - 1))); // apuesta para ganar ~maxWin neto
  const netWin = Math.floor(stake * eff) - stake;            // neto real por victoria
  let ruinCount = 0;
  let sumEnd = 0, sumMaxDD = 0, minEnd = Infinity;
  for (let s = 0; s < sims; s++) {
    let bank = reserve;
    let peak = reserve, maxDD = 0;
    let ruined = false;
    for (let d = 0; d < days && !ruined; d++) {
      let dayNet = 0; // neto del jugador en el día (limita arriba a maxDaily)
      for (let pl = 0; pl < playsPerDay; pl++) {
        if (Math.random() < p) { // jugador gana
          bank -= netWin; dayNet += netWin;
        } else {                  // casa gana el stake
          bank += stake; dayNet -= stake;
        }
        if (bank <= 0) { ruined = true; break; }
        if (dayNet >= maxDaily) break; // alcanzó tope diario de ganancia
        const dd = peak - bank; if (dd > maxDD) maxDD = dd;
        if (bank > peak) peak = bank;
      }
    }
    if (ruined) ruinCount++;
    sumEnd += Math.max(0, bank); sumMaxDD += maxDD; minEnd = Math.min(minEnd, bank);
  }
  return { eff, stake, netWin, p, ruinProb: ruinCount / sims, avgEnd: sumEnd / sims, avgMaxDD: sumMaxDD / sims, minEnd };
}

console.log(`${NL}(A) Adversario relentless HI-LO (máxima varianza; 1 año = 365 días):`);
console.log("    Configuración        oddsAdv  stake   netWin/win  playsDia  P(ruina)  DD_medio  banca_fin_media");
const advConfigs = [
  { label: "ACTUAL", maxWin: 100_000, maxDaily: 1_000_000 },
  { label: "PROPUESTO x1.5", maxWin: 150_000, maxDaily: 1_500_000 },
  { label: "AGRESIVO x3", maxWin: 300_000, maxDaily: 3_000_000 },
];
// La peor cuota para la casa (mayor varianza/edge) es la máxima admisible. A cuota 4900
// el stake para ganar 100k sería ~20; probamos cuotas altas realistas y la extrema.
for (const cfg of advConfigs) {
  for (const oddsAdv of [10, 100, 4900]) {
    const r = simulateAdversary({ ...cfg, oddsAdv, playsPerDay: 120 * 16, days: 365, sims: 4000, reserve: RESERVE });
    // 120 jugadas/min × ~16 min de juego sostenido al día como cota alta de un bot tope-rate
    console.log(`    ${cfg.label.padEnd(18)} ${String(oddsAdv).padStart(6)}x  ${fmt(r.stake).padStart(6)}  ${fmt(r.netWin).padStart(9)}   ${(120*16).toString().padStart(7)}   ${pct(r.ruinProb).padStart(7)}   ${fmt(r.avgMaxDD).padStart(8)}  ${fmt(r.avgEnd).padStart(12)}`);
  }
}

// ===========================================================================
// (B) VOLUMEN AGREGADO NORMAL: muchos jugadores con mezcla realista de cuotas.
//     Edge casa 2% sobre el turnover. Modelamos PnL diario ~ Normal(0.02·T, σ_dia)
//     con σ_dia derivada de la varianza por jugada agregada. Drawdown a 1 año.
// ===========================================================================
console.log(`${NL}(B) Volumen agregado HI-LO (edge casa 2%); PnL casa diario y drawdown a 1 año:`);
console.log("    turnover/dia   maxWin   P&L_medio/dia   σ_dia      DD_máx_1año(P95)   P(ruina 1año)");
function simulateAggregate({ dailyTurnover, maxWin, days, sims, reserve }) {
  // Mezcla de cuotas: la mayoría baja (≈2x), cola a cuotas altas. Varianza por ficha
  // apostada depende de la cuota. Tomamos una cuota efectiva media de varianza usando
  // jugadas que apuntan a repartir el turnover; cota superior de riesgo: fracción f del
  // turnover en jugadas de máx varianza (ganar maxWin a 100x), resto a 2x.
  const fHigh = 0.10; // 10% del turnover en cuotas altas (cota conservadora de cola)
  // jugada alta: odds 100, p=0.0098, payout neto = maxWin, stake = maxWin/99
  const effH = hiLoEffectiveOdds(hiLoWinningOutcomes(100)); const pH = hiLoWinningOutcomes(100) / 10000;
  const stakeH = Math.max(1, Math.floor(maxWin / (effH - 1)));
  // jugada baja: odds 2, p=0.49, payout neto = stake
  const effL = 2, pL = 0.49;
  let ruin = 0; const dds = [];
  for (let s = 0; s < sims; s++) {
    let bank = reserve, peak = reserve, maxDD = 0; let ruined = false;
    for (let d = 0; d < days && !ruined; d++) {
      // nº de jugadas altas y bajas para cubrir el turnover del día
      const turnoverHigh = dailyTurnover * fHigh, turnoverLow = dailyTurnover * (1 - fHigh);
      const nHigh = Math.max(0, Math.round(turnoverHigh / stakeH));
      const nLow = Math.max(0, Math.round(turnoverLow / 1000)); // stake medio bajo ~1000
      let dayPnl = 0;
      for (let i = 0; i < nHigh; i++) dayPnl += (Math.random() < pH ? -(Math.floor(stakeH*effH)-stakeH) : stakeH);
      for (let i = 0; i < nLow; i++) dayPnl += (Math.random() < pL ? -1000 : 1000); // odds 2: gana/pierde 1000
      bank += dayPnl;
      if (bank <= 0) { ruined = true; }
      const dd = peak - bank; if (dd > maxDD) maxDD = dd; if (bank > peak) peak = bank;
    }
    if (ruined) ruin++; dds.push(maxDD);
  }
  dds.sort((a, b) => a - b);
  return { ruinProb: ruin / sims, ddP95: dds[Math.floor(sims * 0.95)], avgDD: dds.reduce((a,b)=>a+b,0)/sims };
}
for (const dailyTurnover of [500_000, 2_000_000, 10_000_000]) {
  for (const maxWin of [100_000, 300_000]) {
    const r = simulateAggregate({ dailyTurnover, maxWin, days: 365, sims: 3000, reserve: RESERVE });
    const pnlMean = 0.02 * dailyTurnover;
    console.log(`    ${fmt(dailyTurnover).padStart(11)}   ${fmt(maxWin).padStart(6)}   ${("+"+fmt(pnlMean)).padStart(12)}   ${"~".padStart(2)}        ${fmt(r.ddP95).padStart(13)}     ${pct(r.ruinProb).padStart(7)}`);
  }
}

// ===========================================================================
// (C) RESUMEN: límites actuales → propuestos → riesgo
// ===========================================================================
console.log(`${NL}(C) Notas clave para la recomendación:`);
console.log(`    · Reserva banca = ${fmt(RESERVE)} fichas (10.000 BOLIS de 250.000 supply).`);
console.log(`    · MAX_DAILY_WIN actual (1.000.000) = 10% de la reserva por jugador y día.`);
console.log(`    · MAX_WIN por jugada actual (100.000) = 1% de la reserva.`);
console.log(`    · El tope diario es el verdadero freno de ruina: acota el upside del jugador`);
console.log(`      mientras el edge del 2% sigue erosionando su banca jugada a jugada.`);
console.log("=".repeat(76));
