/**
 * Configuración de equivalencia y límites.
 * Valores por defecto que pueden sobreescribirse desde admin (site_settings) o env vars.
 */
export const POINTS_PER_BOLIS = Number(process.env.NEXT_PUBLIC_POINTS_PER_BOLIS) || 1000;
export const MIN_WITHDRAW_POINTS = Number(process.env.NEXT_PUBLIC_MIN_WITHDRAW_POINTS) || 10_000;
export const FAUCET_POINTS = Number(process.env.NEXT_PUBLIC_FAUCET_POINTS) || 100;
export const FAUCET_COOLDOWN_HOURS = Number(process.env.NEXT_PUBLIC_FAUCET_COOLDOWN_HOURS) || 1;
export const WELCOME_POINTS = Number(process.env.NEXT_PUBLIC_WELCOME_POINTS) || 100;

/** Mint BOLIS en Solana */
export const BOLIS_MINT = "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha";

export const MAX_SESSIONS_PER_IP = Number(process.env.NEXT_PUBLIC_MAX_SESSIONS_PER_IP) || 3;

export const AFFILIATE_COMMISSION_PERCENT = Number(process.env.NEXT_PUBLIC_AFFILIATE_COMMISSION_PERCENT) || 50;
/** % de comisión sobre logros reclamados por el referido */
export const AFFILIATE_ACHIEVEMENT_PERCENT = Number(process.env.NEXT_PUBLIC_AFFILIATE_ACHIEVEMENT_PERCENT) || 10;
/** Bonus único cuando un referido verifica su email */
export const REFERRAL_VERIFIED_BONUS = Number(process.env.NEXT_PUBLIC_REFERRAL_VERIFIED_BONUS) || 10_000;

/** Cada cuántos reclamos del faucet se pide CAPTCHA */
export const CAPTCHA_INTERVAL = Number(process.env.NEXT_PUBLIC_CAPTCHA_INTERVAL) || 4;

/** Cada cuántos reclamos del faucet se exige haber jugado al menos 1 vez HI-LO en las últimas 24h */
export const FAUCET_ENGAGEMENT_EVERY = Number(process.env.NEXT_PUBLIC_FAUCET_ENGAGEMENT_EVERY) || 10;

/** Mínimo de apuestas HI-LO que un referido debe tener para que el referente reciba el bonus */
export const REFERRAL_MIN_BETS = Number(process.env.NEXT_PUBLIC_REFERRAL_MIN_BETS) || 20;
/** Mínimo de días registrado para que cuente como referido válido */
export const REFERRAL_MIN_DAYS = Number(process.env.NEXT_PUBLIC_REFERRAL_MIN_DAYS) || 3;

/** HI-LO */
export const HILO_PLAYER_WIN_CHANCE = Number(process.env.NEXT_PUBLIC_HILO_PLAYER_WIN_CHANCE) || 0.49;
export const HILO_WIN_MULTIPLIER = Number(process.env.NEXT_PUBLIC_HILO_WIN_MULTIPLIER) || 2;

/** House reserves: 10,000 BOLIS of 250,000 total. Max win = 1,000 BOLIS = 1,000,000 pts */
export const HOUSE_BOLIS_RESERVE = Number(process.env.NEXT_PUBLIC_HOUSE_BOLIS_RESERVE) || 10_000;
export const BOLIS_TOTAL_SUPPLY = Number(process.env.NEXT_PUBLIC_BOLIS_TOTAL_SUPPLY) || 250_000;
export const MAX_BET_POINTS = Number(process.env.NEXT_PUBLIC_MAX_BET_POINTS) || 100_000;
export const MAX_WIN_POINTS = Number(process.env.NEXT_PUBLIC_MAX_WIN_POINTS) || 100_000;
export const MAX_DAILY_WIN_POINTS = Number(process.env.NEXT_PUBLIC_MAX_DAILY_WIN_POINTS) || 300_000;
