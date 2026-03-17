/**
 * Configuración de equivalencia y límites.
 * Ajustable luego desde admin o variables de entorno.
 */
export const POINTS_PER_BOLIS = Number(process.env.NEXT_PUBLIC_POINTS_PER_BOLIS) || 1000;
export const MIN_WITHDRAW_POINTS = Number(process.env.NEXT_PUBLIC_MIN_WITHDRAW_POINTS) || 10_000;
export const FAUCET_POINTS = Number(process.env.NEXT_PUBLIC_FAUCET_POINTS) || 100;
export const FAUCET_COOLDOWN_HOURS = Number(process.env.NEXT_PUBLIC_FAUCET_COOLDOWN_HOURS) || 1;
/** Puntos por registrarse / primera vez que ingresas */
export const WELCOME_POINTS = Number(process.env.NEXT_PUBLIC_WELCOME_POINTS) || 100;

/** Mint BOLIS en Solana */
export const BOLIS_MINT = "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha";

/** Máximo de sesiones/conexiones por IP (anti-fraude) */
export const MAX_SESSIONS_PER_IP = Number(process.env.NEXT_PUBLIC_MAX_SESSIONS_PER_IP) || 3;

/** Porcentaje comisión afiliados (ej. 50 = 50%) */
export const AFFILIATE_COMMISSION_PERCENT = Number(process.env.NEXT_PUBLIC_AFFILIATE_COMMISSION_PERCENT) || 50;

/** HI-LO: probabilidad de acierto del jugador (0.49 = 49% jugador, 51% casa) */
export const HILO_PLAYER_WIN_CHANCE = Number(process.env.NEXT_PUBLIC_HILO_PLAYER_WIN_CHANCE) || 0.49;
/** HI-LO: multiplicador al ganar (2 = doblas la apuesta) */
export const HILO_WIN_MULTIPLIER = Number(process.env.NEXT_PUBLIC_HILO_WIN_MULTIPLIER) || 2;
