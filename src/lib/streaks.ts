export interface StreakTier {
  min: number;
  max: number;
  multiplier?: number;
  bonus?: number;
}

export const DEFAULT_HOURLY_TIERS: StreakTier[] = [
  { min: 1, max: 2, multiplier: 1.0 },
  { min: 3, max: 4, multiplier: 1.5 },
  { min: 5, max: 6, multiplier: 2.0 },
  { min: 7, max: 8, multiplier: 2.5 },
  { min: 9, max: 999999, multiplier: 3.0 },
];

export const DEFAULT_DAILY_TIERS: StreakTier[] = [
  { min: 1, max: 1, bonus: 0 },
  { min: 2, max: 3, bonus: 0.1 },
  { min: 4, max: 7, bonus: 0.25 },
  { min: 8, max: 14, bonus: 0.5 },
  { min: 15, max: 30, bonus: 0.75 },
  { min: 31, max: 999999, bonus: 1.0 },
];

export function getHourlyMultiplier(streak: number, tiers: StreakTier[] = DEFAULT_HOURLY_TIERS): number {
  const s = Math.max(1, streak);
  const tier = tiers.find((t) => s >= t.min && s <= t.max);
  return tier?.multiplier ?? 1;
}

export function getDailyBonus(streak: number, tiers: StreakTier[] = DEFAULT_DAILY_TIERS): number {
  const s = Math.max(1, streak);
  const tier = tiers.find((t) => s >= t.min && s <= t.max);
  return tier?.bonus ?? 0;
}

export function calculatePayout(
  base: number,
  hourlyStreak: number,
  dailyStreak: number,
  hourlyTiers?: StreakTier[],
  dailyTiers?: StreakTier[]
): { payout: number; hourlyMultiplier: number; dailyBonus: number } {
  const hourlyMultiplier = getHourlyMultiplier(hourlyStreak, hourlyTiers);
  const dailyBonus = getDailyBonus(dailyStreak, dailyTiers);
  const payout = Math.floor(base * hourlyMultiplier * (1 + dailyBonus));
  return { payout, hourlyMultiplier, dailyBonus };
}

export function isHourlyStreakBroken(lastClaimAt: Date | null, cooldownMs: number): boolean {
  if (!lastClaimAt) return true;
  return Date.now() - lastClaimAt.getTime() > cooldownMs * 2;
}

export function isDailyStreakBroken(lastStreakDate: string | null): boolean {
  if (!lastStreakDate) return true;
  const last = new Date(lastStreakDate + "T00:00:00Z");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays > 1;
}

export function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
