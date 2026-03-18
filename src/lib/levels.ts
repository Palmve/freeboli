export interface UserLevel {
  level: number;
  name: string;
  icon: string;
  color: string;
  minBets: number;
  minFaucet: number;
  minReferrals: number;
  requiresEmail: boolean;
}

export const LEVELS: UserLevel[] = [
  { level: 1, name: "Novato",    icon: "🥉", color: "text-slate-400",   minBets: 0,     minFaucet: 0,    minReferrals: 0,  requiresEmail: false },
  { level: 2, name: "Aprendiz",  icon: "🥈", color: "text-sky-400",     minBets: 5,     minFaucet: 10,   minReferrals: 0,  requiresEmail: true },
  { level: 3, name: "Jugador",   icon: "🥇", color: "text-blue-400",    minBets: 50,    minFaucet: 50,   minReferrals: 0,  requiresEmail: true },
  { level: 4, name: "Veterano",  icon: "⭐", color: "text-purple-400",  minBets: 300,   minFaucet: 200,  minReferrals: 1,  requiresEmail: true },
  { level: 5, name: "Experto",   icon: "💎", color: "text-emerald-400", minBets: 1000,  minFaucet: 500,  minReferrals: 3,  requiresEmail: true },
  { level: 6, name: "Maestro",   icon: "👑", color: "text-amber-400",   minBets: 5000,  minFaucet: 2000, minReferrals: 10, requiresEmail: true },
  { level: 7, name: "Leyenda",   icon: "🔥", color: "text-red-400",     minBets: 10000, minFaucet: 5000, minReferrals: 25, requiresEmail: true },
];

export function getUserLevel(stats: {
  betCount: number;
  faucetClaims: number;
  referralCount: number;
  emailVerified: boolean;
}): UserLevel {
  let result = LEVELS[0];
  for (const lvl of LEVELS) {
    if (lvl.requiresEmail && !stats.emailVerified) continue;
    if (stats.betCount >= lvl.minBets && stats.faucetClaims >= lvl.minFaucet && stats.referralCount >= lvl.minReferrals) {
      result = lvl;
    }
  }
  return result;
}

export function getNextLevel(current: UserLevel): UserLevel | null {
  const idx = LEVELS.findIndex((l) => l.level === current.level);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export function getLevelProgress(stats: {
  betCount: number;
  faucetClaims: number;
  referralCount: number;
  emailVerified: boolean;
}, target: UserLevel): { bets: number; faucet: number; referrals: number; email: boolean } {
  return {
    bets: Math.min(stats.betCount / Math.max(target.minBets, 1), 1),
    faucet: Math.min(stats.faucetClaims / Math.max(target.minFaucet, 1), 1),
    referrals: Math.min(stats.referralCount / Math.max(target.minReferrals, 1), 1),
    email: !target.requiresEmail || stats.emailVerified,
  };
}
