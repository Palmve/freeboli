import { createHash, randomBytes } from "crypto";

// ===== Réplica EXACTA de src/lib/hilo.ts =====
const HILO_ROLL_MOD = 10000;
const HILO_HOUSE_EDGE_FACTOR = 98;

function rollFromSeeds(serverSeed, clientSeed, nonce) {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`;
  const hash = createHash("sha256").update(combined, "utf8").digest();
  const n = hash.readUInt32BE(0);
  return n % HILO_ROLL_MOD;
}
function hiLoWinningOutcomes(oddsEffective) {
  const raw = Math.round((HILO_HOUSE_EDGE_FACTOR * 100) / oddsEffective);
  return Math.min(9900, Math.max(1, raw));
}
function isPlayerWin(roll, choice, odds) {
  const k = hiLoWinningOutcomes(odds);
  if (choice === "hi") return roll >= HILO_ROLL_MOD - k;
  return roll <= k - 1;
}

// ---- 1) RTP teórico vs empírico HI-LO, varias cuotas y tamaños de apuesta ----
const N = 2_000_000;
const oddsList = [1.01, 1.10, 1.50, 1.95, 2, 3, 5, 10, 50, 100, 1000, 4900];
const bets = [1, 5, 10, 100];

function rng() { return Math.floor(Math.random() * 4294967296); } // uint32

console.log("=== HI-LO: RTP empírico vs teórico (choice=hi) ===");
console.log("odds\tk\twin%\tbet\tRTP_teor(k*odds)\tRTP_real(floor)\tRTP_emp\tedge_real%");
for (const odds of oddsList) {
  const k = hiLoWinningOutcomes(odds);
  const winP = k / HILO_ROLL_MOD;
  const rtpTheoIdeal = winP * odds;              // si pagara exacto
  for (const bet of bets) {
    const payout = Math.floor(bet * odds);        // fórmula real
    const rtpRealFormula = winP * (payout / bet); // RTP determinista por floor
    // Monte Carlo
    let staked = 0, returned = 0;
    for (let i = 0; i < N; i++) {
      const roll = rng() % HILO_ROLL_MOD;
      staked += bet;
      if (roll >= HILO_ROLL_MOD - k) returned += payout;
    }
    const emp = returned / staked;
    console.log(
      `${odds}\t${k}\t${(winP*100).toFixed(2)}\t${bet}\t${rtpTheoIdeal.toFixed(4)}\t\t${rtpRealFormula.toFixed(4)}\t\t${emp.toFixed(4)}\t${((1-rtpRealFormula)*100).toFixed(2)}`
    );
  }
}

// ---- 2) Sesgo de módulo: distribución de remainders uint32 % 10000 ----
console.log("\n=== Sesgo de módulo uint32 % 10000 ===");
const M = 4294967296;
const full = Math.floor(M / HILO_ROLL_MOD); // 429496
const extra = M % HILO_ROLL_MOD;            // 7296
console.log(`uint32 espacio=${M}, floor(M/10000)=${full}, sobrante=${extra}`);
console.log(`Remainders 0..${extra-1} aparecen ${full+1} veces; ${extra}..9999 aparecen ${full} veces`);
console.log(`Sesgo relativo por celda 'caliente' = ${(1/full*100).toExponential(3)}%`);
// Impacto: HI gana en rolls altos (9999-k..9999) -> celdas "frías"; LO gana en bajos -> "calientes"
for (const odds of [2, 100, 4900]) {
  const k = hiLoWinningOutcomes(odds);
  // LO gana en 0..k-1
  let loCount = 0; for (let r = 0; r < k; r++) loCount += (r < extra ? full+1 : full);
  // HI gana en 10000-k..9999
  let hiCount = 0; for (let r = HILO_ROLL_MOD-k; r < HILO_ROLL_MOD; r++) hiCount += (r < extra ? full+1 : full);
  const loProb = loCount / M, hiProb = hiCount / M, nominal = k / HILO_ROLL_MOD;
  console.log(`odds=${odds} k=${k}: P(LO)=${loProb.toFixed(8)} P(HI)=${hiProb.toFixed(8)} nominal=${nominal.toFixed(8)} | LO/HI ventaja=${((loProb-hiProb)/nominal*100).toFixed(4)}%`);
}

// ---- 3) Provably fair: ¿puede el servidor "moler" semillas para forzar pérdida? ----
console.log("\n=== Grinding de server_seed (no hay compromiso previo) ===");
// El servidor genera server_seed DESPUÉS de conocer choice/odds. Simulamos que busca una semilla perdedora.
const choice = "hi", oddsG = 2, clientSeed = "abc", nonce = 1;
const kG = hiLoWinningOutcomes(oddsG);
let tries = 0, found = false;
for (let i = 0; i < 1000; i++) {
  tries++;
  const ss = randomBytes(32).toString("hex");
  const roll = rollFromSeeds(ss, clientSeed, nonce);
  if (!isPlayerWin(roll, choice, oddsG)) { found = true; break; }
}
console.log(`Forzar derrota con prob acierto ${(kG/100).toFixed(2)}%: encontrada semilla perdedora en ${tries} intentos (trivial). found=${found}`);

// ---- 4) PREDICCIONES MICRO: RTP (adivina 1 dígito de 10) ----
console.log("\n=== PREDICCIONES MICRO: RTP por cuota ===");
for (const o of [7, 8, 9]) {
  // outcome dígito uniforme 0..9, jugador acierta con prob 1/10
  let staked = 0, returned = 0;
  for (let i = 0; i < N; i++) {
    const pred = Math.floor(Math.random()*10);
    const outcome = Math.floor(Math.random()*10);
    staked += 1;
    if (pred === outcome) returned += Math.floor(1 * o); // payout
  }
  console.log(`cuota=${o}x  RTP_teor=${(o/10).toFixed(3)}  RTP_emp=${(returned/staked).toFixed(4)}  edge=${((1-o/10)*100).toFixed(1)}%`);
}

// ---- 5) PREDICCIONES UP/DOWN: RTP si el modelo sigmoide ESTUVIERA bien calibrado ----
console.log("\n=== PREDICCIONES UP/DOWN: RTP implícito = (1-houseEdge) ===");
console.log("Por construcción odds=(1/winProb)*(1-he) -> RTP=winProb*odds=(1-he). Con he=0.05 => RTP=0.95 (SOLO si el modelo de prob. es correcto).");
console.log("Riesgo: winProb es heurística sigmoide, no probabilidad real -> bettor afilado puede hallar +EV.");
