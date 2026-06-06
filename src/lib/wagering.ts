/**
 * Lógica pura del requisito de apuesta (wagering) y del tope global de pagos.
 * Fuente de verdad de la matemática; los RPCs SQL (migración 039) la espejan.
 * Invariante: retirable = max(0, points - lockedPoints).
 */

export interface BalanceState {
  points: number;
  lockedPoints: number;
  wageringRemaining: number;
}

/** Fichas que el usuario puede retirar ahora mismo. */
export function computeWithdrawable(b: { points: number; lockedPoints: number }): number {
  return Math.max(0, b.points - b.lockedPoints);
}

/** Acredita un bono: bloquea el principal y añade requisito de apuesta = monto * mult. */
export function bonusCredit(b: BalanceState, amount: number, mult: number): BalanceState {
  return {
    points: b.points + amount,
    lockedPoints: b.lockedPoints + amount,
    wageringRemaining: b.wageringRemaining + amount * mult,
  };
}

/** Aplica una apuesta de importe `bet`: reduce wagering; al llegar a 0 limpia el lock. */
export function applyWager(b: BalanceState, bet: number): BalanceState {
  const remaining = Math.max(0, b.wageringRemaining - bet);
  return {
    points: b.points,
    lockedPoints: remaining === 0 ? 0 : b.lockedPoints,
    wageringRemaining: remaining,
  };
}

/** Tope global diario de pagos on-chain: ¿este retiro superaría el presupuesto del día? */
export function isGlobalCapReached(args: {
  paidBolisToday: number;
  thisBolis: number;
  capBolis: number;
}): boolean {
  return args.paidBolisToday + args.thisBolis > args.capBolis;
}
