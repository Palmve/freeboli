// Tests puros de la estimación de σ (sin red). Importa el .ts real (Node 24 type-strip).
import assert from "node:assert/strict";
import { ewmaSigmaFromCloses, clampSigma } from "../src/lib/volatility.ts";

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

// 1) Serie con crecimiento multiplicativo constante g: r_i = ln(1+g) constante,
//    así la EWMA de r² converge a ln(1+g)² ⇒ σ = |ln(1+g)|.
const g = 0.003;
const closes = Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1 + g, i));
const sigma = ewmaSigmaFromCloses(closes);
assert.ok(sigma !== null, "σ no debería ser null con 59 retornos");
assert.ok(Math.abs(sigma - Math.abs(Math.log(1 + g))) < 1e-6, `σ ${sigma} != ${Math.abs(Math.log(1+g))}`);
ok("ewmaSigmaFromCloses: serie de retorno constante ⇒ σ = |ln(1+g)|");

// 2) Datos insuficientes (< 30 retornos) ⇒ null.
assert.equal(ewmaSigmaFromCloses(Array.from({ length: 10 }, (_, i) => 100 + i)), null);
ok("ewmaSigmaFromCloses: < 30 retornos ⇒ null");

// 3) Monotonía: más volátil ⇒ σ mayor.
const calm = Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1.001, i));
const wild = Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1.02, i));
assert.ok(ewmaSigmaFromCloses(wild) > ewmaSigmaFromCloses(calm), "σ(wild) > σ(calm)");
ok("ewmaSigmaFromCloses: monótona en volatilidad");

// 4) clampSigma acota a [baseline×0.5, baseline×4].
assert.equal(clampSigma(0.001, 0.0065), 0.0065 * 0.5); // por debajo del piso
assert.equal(clampSigma(0.05, 0.0065), 0.0065 * 4);     // por encima del techo
assert.equal(clampSigma(0.01, 0.0065), 0.01);           // dentro
ok("clampSigma: acota a [baseline×0.5, baseline×4]");

console.log(`\n✅ ${passed}/4 grupos de aserciones OK`);
