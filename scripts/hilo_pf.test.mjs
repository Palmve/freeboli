// Test del provably-fair HI-LO (#2): compromiso, determinismo y consistencia con el
// verificador del cliente. Importa el código REAL (Node 24 type-strip).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  HILO_ROLL_MOD,
  rollFromSeeds,
  hashServerSeed,
  generateServerSeed,
  generateClientSeed,
  settleHiLo,
} from "../src/lib/hilo.ts";

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

// Réplica EXACTA del verificador del navegador (src/app/hi-lo/verificar/page.tsx)
function rollClient(serverSeed, clientSeed, nonce) {
  const hashHex = createHash("sha256").update(`${serverSeed}:${clientSeed}:${nonce}`, "utf8").digest("hex");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 2) bytes[i / 2] = parseInt(hashHex.slice(i, i + 2), 16);
  const view = new DataView(bytes.buffer);
  return view.getUint32(0, false) % 10000;
}

// 1) Compromiso: el hash generado == sha256(serverSeed)
const { serverSeed, serverSeedHash } = generateServerSeed();
assert.equal(serverSeedHash, createHash("sha256").update(serverSeed, "utf8").digest("hex"));
assert.equal(serverSeedHash, hashServerSeed(serverSeed));
assert.equal(serverSeed.length, 64); // 32 bytes hex
ok("generateServerSeed: hash == sha256(serverSeed)");

// 2) client seed por defecto válido
const cs = generateClientSeed();
assert.equal(cs.length, 32);
ok("generateClientSeed: 16 bytes hex");

// 3) rollFromSeeds determinista y dentro de rango
const r1 = rollFromSeeds(serverSeed, cs, 1);
const r2 = rollFromSeeds(serverSeed, cs, 1);
assert.equal(r1, r2);
assert.ok(r1 >= 0 && r1 < HILO_ROLL_MOD);
ok("rollFromSeeds determinista y en [0,10000)");

// 4) El roll del servidor coincide con el del verificador del cliente (provably fair)
for (let n = 0; n < 500; n++) {
  const a = rollFromSeeds(serverSeed, cs, n);
  const b = rollClient(serverSeed, cs, n);
  assert.equal(a, b, `desajuste servidor/cliente en nonce ${n}: ${a} != ${b}`);
}
ok("roll servidor == roll verificador cliente (500 nonces)");

// 5) settleHiLo es pura y coherente: mismo roll -> mismo resultado; regla HI/LO correcta
const k = settleHiLo(100, "hi", 2, 0).k; // k para odds 2
// HI gana en los k valores más altos
assert.equal(settleHiLo(100, "hi", 2, HILO_ROLL_MOD - 1).win, true);
assert.equal(settleHiLo(100, "hi", 2, HILO_ROLL_MOD - k).win, true);
assert.equal(settleHiLo(100, "hi", 2, HILO_ROLL_MOD - k - 1).win, false);
// LO gana en los k valores más bajos
assert.equal(settleHiLo(100, "lo", 2, 0).win, true);
assert.equal(settleHiLo(100, "lo", 2, k - 1).win, true);
assert.equal(settleHiLo(100, "lo", 2, k).win, false);
// pago con cuota efectiva
const w = settleHiLo(100, "hi", 2, HILO_ROLL_MOD - 1);
assert.equal(w.payout, Math.floor(100 * w.effectiveOdds));
ok("settleHiLo: regla HI/LO y pago con cuota efectiva correctos");

// 6) Determinismo total: mismas entradas -> mismo settle
const x1 = settleHiLo(50, "lo", 3.5, 1234);
const x2 = settleHiLo(50, "lo", 3.5, 1234);
assert.deepEqual(x1, x2);
ok("settleHiLo determinista");

console.log(`\n✅ ${passed}/6 grupos de aserciones OK`);
