const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

type AlertLevel = "info" | "warning" | "critical";

const LEVEL_EMOJI: Record<AlertLevel, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

export async function sendTelegramMessage(text: string, level: AlertLevel = "info"): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("TELEGRAM: Falta BOT_TOKEN o CHAT_ID");
    return false;
  }

  const prefix = LEVEL_EMOJI[level];
  const fullText = `<b>${prefix} FreeBoli</b>\n\n${text}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: fullText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("TELEGRAM ERROR:", res.status, errData);
    }
    return res.ok;
  } catch (e) {
    console.error("TELEGRAM FETCH EXCEPTION:", e);
    return false;
  }
}

export async function alertNewUser(email: string, hasReferrer: boolean) {
  const ref = hasReferrer ? " (con referido)" : "";
  await sendTelegramMessage(`👤 <b>Nuevo usuario registrado</b>\n${maskEmail(email)}${ref}`, "info");
}

export async function alertWithdrawalRequest(email: string, points: number, wallet: string) {
  await sendTelegramMessage(
    `💸 <b>Solicitud de retiro</b>\nUsuario: ${maskEmail(email)}\nPuntos: ${points.toLocaleString()}\nWallet: <code>${wallet.slice(0, 8)}...${wallet.slice(-4)}</code>`,
    "warning"
  );
}

export async function alertWithdrawalCompleted(email: string, points: number, tx: string) {
  await sendTelegramMessage(
    `✅ <b>Retiro procesado con éxito</b>\nUsuario: ${maskEmail(email)}\nPuntos: ${points.toLocaleString()}\nTx: <code>${tx.slice(0, 12)}...</code>`,
    "info"
  );
}

export async function alertDepositDetected(email: string, points: number, txSignature: string) {
  await sendTelegramMessage(
    `💰 <b>Depósito detectado</b>\nUsuario: ${maskEmail(email)}\nPuntos: ${points.toLocaleString()}\nTx: <code>${txSignature.slice(0, 12)}...</code>`,
    "info"
  );
}

export async function alertLargeWin(email: string, bet: number, payout: number) {
  await sendTelegramMessage(
    `🎰 <b>Gran ganancia HI-LO</b>\nUsuario: ${maskEmail(email)}\nApuesta: ${bet.toLocaleString()} pts\nGanancia: ${payout.toLocaleString()} pts`,
    "warning"
  );
}

export async function alertDailyLimitReached(email: string, totalWon: number) {
  await sendTelegramMessage(
    `🛑 <b>Límite diario alcanzado</b>\nUsuario: ${maskEmail(email)}\nGanado hoy: ${totalWon.toLocaleString()} pts`,
    "warning"
  );
}

export async function alertSuspiciousActivity(email: string, reason: string) {
  await sendTelegramMessage(
    `🔍 <b>Actividad sospechosa</b>\nUsuario: ${maskEmail(email)}\nRazón: ${reason}`,
    "critical"
  );
}

export async function alertUserBlocked(email: string, status: string) {
  await sendTelegramMessage(
    `🚫 <b>Usuario ${status}</b>\n${maskEmail(email)}`,
    "critical"
  );
}

export async function alertMultipleAccountsIP(ip: string, count: number) {
  await sendTelegramMessage(
    `🕵️ <b>Múltiples cuentas desde misma IP</b>\nIP hash: <code>${ip.slice(0, 12)}</code>\nCuentas: ${count}`,
    "critical"
  );
}

export async function alertSystemError(endpoint: string, error: string) {
  await sendTelegramMessage(
    `❌ <b>Error del sistema</b>\nEndpoint: ${endpoint}\nError: ${error}`,
    "critical"
  );
}

export interface DailySummaryStats {
  connections: number;       // page_views/eventos en analytics_events (24h)
  connectedUsers: number;    // usuarios únicos que se conectaron (24h)
  activeUsers: number;       // usuarios únicos con movimientos (jugaron/reclamaron)
  newUsers: number;
  hiLoBets: number;          hiLoBetPoints: number;   hiLoPayoutPoints: number;
  predBets: number;          predBetPoints: number;   predPayoutPoints: number;
  faucetClaims: number;      faucetPoints: number;
  withdrawalRequests: number;
  depositCount: number;
}

function fmtNet(n: number): string {
  return `${n >= 0 ? "+" : ""}${Math.round(n).toLocaleString()}`;
}

export async function sendDailySummary(s: DailySummaryStats) {
  const hiLoHouse = s.hiLoBetPoints - s.hiLoPayoutPoints;
  const predHouse = s.predBetPoints - s.predPayoutPoints;
  const houseNet = hiLoHouse + predHouse;       // + = la casa ganó
  const playersNet = -houseNet;                  // cara opuesta

  const text = `📊 <b>Resumen diario (24h)</b>

👥 Conexiones: <b>${s.connections}</b> (${s.connectedUsers} usuarios)
🟢 Activos (jugaron/reclamaron): <b>${s.activeUsers}</b>
👤 Nuevos registros: <b>${s.newUsers}</b>

🎰 <b>HI-LO</b>: ${s.hiLoBets} apuestas · apostado ${s.hiLoBetPoints.toLocaleString()} · pagado ${s.hiLoPayoutPoints.toLocaleString()} → casa ${fmtNet(hiLoHouse)}
🔮 <b>Predicciones</b>: ${s.predBets} apuestas · apostado ${s.predBetPoints.toLocaleString()} · pagado ${s.predPayoutPoints.toLocaleString()} → casa ${fmtNet(predHouse)}
🚰 Faucet: ${s.faucetClaims} reclamos (${s.faucetPoints.toLocaleString()} pts)

🏦 <b>Casa hoy: ${fmtNet(houseNet)} pts</b>  ${houseNet >= 0 ? "🟢" : "🔴"}
🧑‍🤝‍🧑 Jugadores hoy: ${fmtNet(playersNet)} pts

💸 Retiros solicitados: ${s.withdrawalRequests}
💰 Depósitos: ${s.depositCount}`;

  return await sendTelegramMessage(text, "info");
}

/** Pulso ligero cada X horas: señal de que la app respira. */
export async function sendActivityPulse(stats: {
  windowHours: number;
  connections: number;
  connectedUsers: number;
  bets: number;
  faucetClaims: number;
}) {
  const dead = stats.connections === 0 && stats.bets === 0 && stats.faucetClaims === 0;
  const text = `🫀 <b>Pulso (últimas ${stats.windowHours}h)</b>
👥 ${stats.connections} conexiones (${stats.connectedUsers} usuarios)
🎲 ${stats.bets} apuestas · 🚰 ${stats.faucetClaims} faucet${dead ? "\n\n⚠️ <i>Sin actividad en esta ventana.</i>" : ""}`;
  return await sendTelegramMessage(text, dead ? "warning" : "info");
}

/** Dead-man's-switch: 24h sin NINGUNA actividad → posible caída de la app. */
export async function sendNoActivityAlert() {
  return await sendTelegramMessage(
    `🚨 <b>24h SIN ACTIVIDAD</b>\nNi conexiones, ni apuestas, ni faucet en las últimas 24h.\nRevisa que la app esté arriba y funcionando.`,
    "critical"
  );
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 3)}***@${domain}`;
}

export function escapeHTML(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function alertSupportTicket(ticketId: string, email: string, type: string, subject: string, message: string) {
  const safeEmail = escapeHTML(email);
  const safeSubject = escapeHTML(subject);
  const safeMessage = escapeHTML(message);
  const safeType = escapeHTML(type.toUpperCase());

  const text = `🚨 <b>NUEVA INCIDENCIA / SOPORTE</b>
--------------------------
ID: <code>${ticketId}</code>
Usuario: ${safeEmail}
Tipo: <b>${safeType}</b>
Asunto: ${safeSubject}

<b>Mensaje:</b>
${safeMessage}

--------------------------
<i>Enviado desde FreeBoli System</i>`;

  return await sendTelegramMessage(text, "critical");
}
