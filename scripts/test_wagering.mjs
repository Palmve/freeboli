import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWithdrawable, bonusCredit, applyWager, isGlobalCapReached } from "../src/lib/wagering.ts";

test("retirable = max(0, points - locked)", () => {
  assert.equal(computeWithdrawable({ points: 200, lockedPoints: 0 }), 200);
  assert.equal(computeWithdrawable({ points: 200, lockedPoints: 50 }), 150);
  assert.equal(computeWithdrawable({ points: 30, lockedPoints: 100 }), 0);
});

test("acreditar bono bloquea principal y suma wagering = monto * mult", () => {
  const r = bonusCredit({ points: 0, lockedPoints: 0, wageringRemaining: 0 }, 100, 20);
  assert.deepEqual(r, { points: 100, lockedPoints: 100, wageringRemaining: 2000 });
});

test("apostar reduce wagering por el importe (gane o pierda)", () => {
  const r = applyWager({ points: 100, lockedPoints: 100, wageringRemaining: 2000 }, 500);
  assert.equal(r.wageringRemaining, 1500);
  assert.equal(r.lockedPoints, 100);
});

test("al llegar wagering a 0, el lock se limpia (todo retirable)", () => {
  const r = applyWager({ points: 100, lockedPoints: 100, wageringRemaining: 400 }, 500);
  assert.equal(r.wageringRemaining, 0);
  assert.equal(r.lockedPoints, 0);
});

test("depósito no bloquea: usa points sin tocar locked (se modela fuera de bonusCredit)", () => {
  assert.equal(computeWithdrawable({ points: 100 + 50, lockedPoints: 100 }), 50);
});

test("tope global: pending solo si pagado_hoy + este > cap", () => {
  assert.equal(isGlobalCapReached({ paidBolisToday: 450, thisBolis: 10, capBolis: 500 }), false);
  assert.equal(isGlobalCapReached({ paidBolisToday: 495, thisBolis: 10, capBolis: 500 }), true);
  assert.equal(isGlobalCapReached({ paidBolisToday: 0, thisBolis: 600, capBolis: 500 }), true);
});
