// VALIDACIÓN DE LA CORRECCIÓN propuesta del modelo de cuotas de Predicciones.
// El modelo actual usa una sigmoide con k=0.8 y piso +0.08 que SUBREACCIONA → favoritos
// sobrepagados. La corrección: usar la probabilidad VERDADERA bajo martingala (CDF normal)
//     probUp = Φ( ln(P_now/P_start) / (σ · √T_left) )
// con σ = volatilidad real por segundo, y pagar odds = (1/prob)·(1−edge). Así el RTP de
// CUALQUIER lado/estrategia = (1−edge) exacto si σ está bien estimada.
//
// node scripts/audit_predictions_fix.mjs
const pct = (x) => (x * 100).toFixed(2) + "%";
function normCdf(x){const t=1/(1+0.2316419*Math.abs(x));const d=0.3989422804014327*Math.exp(-x*x/2);let p=d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?1-p:p;}
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}

const MODEL_SIGMA_1H = { BTC: 0.0065, SOL: 0.012 };
const EDGE = 0.05;

// Modelo CORREGIDO (probit calibrado a la duración de la ronda).
function fixedOdds(side, Pstart, Pnow, tLeft, total, asset, edge) {
  const sigPerSec = (MODEL_SIGMA_1H[asset]) / Math.sqrt(3600); // σ/seg coherente con SIGMAS 1h
  const z = Math.log(Pnow / Pstart) / (sigPerSec * Math.sqrt(Math.max(1, tLeft)));
  let probUp = normCdf(z);
  probUp = Math.max(0.02, Math.min(0.98, probUp));
  const prob = side === "up" ? probUp : 1 - probUp;
  const odds = (1 / prob) * (1 - edge);
  return Math.max(1.01, Math.min(50, parseFloat(odds.toFixed(2))));
}

console.log("=".repeat(72));
console.log("VALIDACIÓN — corrección propuesta del modelo de cuotas (probit calibrado)");
console.log("=".repeat(72));
console.log("    asset/type    RTP_random   RTP_momentum   RTP_sharp   (objetivo ≈ 95%)");

const SCEN = [
  { asset: "BTC", type: "hourly", total: 3600, cutoff: 600 },
  { asset: "BTC", type: "mini", total: 600, cutoff: 120 },
  { asset: "SOL", type: "hourly", total: 3600, cutoff: 600 },
  { asset: "SOL", type: "mini", total: 600, cutoff: 120 },
];
let allOk = true;
for (const sc of SCEN) {
  const sigPerSec = MODEL_SIGMA_1H[sc.asset] / Math.sqrt(3600);
  const N = 500_000; let pR = 0, pM = 0, pS = 0, stake = 0;
  for (let i = 0; i < N; i++) {
    const Pstart = 100;
    const tBet = sc.cutoff + 1 + Math.floor(Math.random() * (sc.total - sc.cutoff));
    const elapsed = sc.total - tBet;
    const Pnow = Pstart * Math.exp(sigPerSec * Math.sqrt(Math.max(1, elapsed)) * gauss() - 0.5 * sigPerSec * sigPerSec * elapsed);
    const oUp = fixedOdds("up", Pstart, Pnow, tBet, sc.total, sc.asset, EDGE);
    const oDown = fixedOdds("down", Pstart, Pnow, tBet, sc.total, sc.asset, EDGE);
    const trueUp = normCdf(Math.log(Pnow / Pstart) / (sigPerSec * Math.sqrt(tBet)));
    const Pclose = Pnow * Math.exp(sigPerSec * Math.sqrt(tBet) * gauss() - 0.5 * sigPerSec * sigPerSec * tBet);
    const up = Pclose > Pstart; stake++;
    const rUp = Math.random() < 0.5; if (rUp === up) pR += rUp ? oUp : oDown;
    const mUp = Pnow >= Pstart; if (mUp === up) pM += mUp ? oUp : oDown;
    const sUp = trueUp * oUp >= (1 - trueUp) * oDown; if (sUp === up) pS += sUp ? oUp : oDown;
  }
  const rR = pR / stake, rM = pM / stake, rS = pS / stake;
  if (rM > 1.0 || rS > 1.0) allOk = false;
  console.log(`    ${(sc.asset + "/" + sc.type).padEnd(12)} ${pct(rR).padStart(9)}   ${pct(rM).padStart(11)}   ${pct(rS).padStart(9)}`);
}
console.log(`${"\n"}${"=".repeat(72)}`);
console.log(`Corrección: ${allOk ? "✅ ninguna estrategia supera el 100% — edge ~5% se mantiene" : "❌ aún explotable"}`);
console.log("Nota: requiere σ bien estimada; con σ_real ≠ σ_modelo el edge varía, por eso se");
console.log("recomienda calibrar σ con histórico real y mantener un margen (edge ≥ 6-8%).");
console.log("=".repeat(72));
