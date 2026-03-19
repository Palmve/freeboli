const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

type AlertLevel = "info" | "warning" | "critical";

const LEVEL_EMOJI: Record<AlertLevel, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

export async function sendTelegramMessage(text: string, level: AlertLevel = "info"): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false;

  const prefix = LEVEL_EMOJI[level];
  const fullText = `${prefix} *FreeBoli*\n\n${text}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: fullText,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function alertNewUser(email: string, hasReferrer: boolean) {
  const ref = hasReferrer ? " (con referido)" : "";
  await sendTelegramMessage(`👤 *Nuevo usuario registrado*\n${maskEmail(email)}${ref}`, "info");
}

export async function alertWithdrawalRequest(email: string, points: number, wallet: string) {
  await sendTelegramMessage(
    `💸 *Solicitud de retiro*\nUsuario: ${maskEmail(email)}\nPuntos: ${points.toLocaleString()}\nWallet: \`${wallet.slice(0, 8)}...${wallet.slice(-4)}\``,
    "warning"
  );
}

export async function alertWithdrawalCompleted(email: string, points: number, tx: string) {
  await sendTelegramMessage(
    `✅ *Retiro procesado con éxito*\nUsuario: ${maskEmail(email)}\nPuntos: ${points.toLocaleString()}\nTx: \`${tx.slice(0, 12)}...\``,
    "info"
  );
}

export async function alertDepositDetected(email: string, points: number, txSignature: string) {
  await sendTelegramMessage(
    `💰 *Depósito detectado*\nUsuario: ${maskEmail(email)}\nPuntos: ${points.toLocaleString()}\nTx: \`${txSignature.slice(0, 12)}...\``,
    "info"
  );
}

export async function alertLargeWin(email: string, bet: number, payout: number) {
  await sendTelegramMessage(
    `🎰 *Gran ganancia HI-LO*\nUsuario: ${maskEmail(email)}\nApuesta: ${bet.toLocaleString()} pts\nGanancia: ${payout.toLocaleString()} pts`,
    "warning"
  );
}

export async function alertDailyLimitReached(email: string, totalWon: number) {
  await sendTelegramMessage(
    `🛑 *Límite diario alcanzado*\nUsuario: ${maskEmail(email)}\nGanado hoy: ${totalWon.toLocaleString()} pts`,
    "warning"
  );
}

export async function alertSuspiciousActivity(email: string, reason: string) {
  await sendTelegramMessage(
    `🔍 *Actividad sospechosa*\nUsuario: ${maskEmail(email)}\nRazón: ${reason}`,
    "critical"
  );
}

export async function alertUserBlocked(email: string, status: string) {
  await sendTelegramMessage(
    `🚫 *Usuario ${status}*\n${maskEmail(email)}`,
    "critical"
  );
}

export async function alertMultipleAccountsIP(ip: string, count: number) {
  await sendTelegramMessage(
    `🕵️ *Múltiples cuentas desde misma IP*\nIP hash: \`${ip.slice(0, 12)}\`\nCuentas: ${count}`,
    "critical"
  );
}

export async function alertSystemError(endpoint: string, error: string) {
  await sendTelegramMessage(
    `❌ *Error del sistema*\nEndpoint: ${endpoint}\nError: ${error}`,
    "critical"
  );
}

export async function sendDailySummary(stats: {
  newUsers: number;
  activeUsers: number;
  totalBets: number;
  totalFaucetClaims: number;
  withdrawalRequests: number;
  depositCount: number;
  platformBalance: number;
}) {
  const text = `📊 *Resumen diario*

👤 Usuarios nuevos: ${stats.newUsers}
🟢 Usuarios activos: ${stats.activeUsers}
🎰 Apuestas HI-LO: ${stats.totalBets}
🚰 Reclamos faucet: ${stats.totalFaucetClaims}
💸 Retiros solicitados: ${stats.withdrawalRequests}
💰 Depósitos: ${stats.depositCount}
📈 Balance plataforma: ${stats.platformBalance.toLocaleString()} pts`;

  return sendTelegramMessage(text, "info");
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 3)}***@${domain}`;
}
