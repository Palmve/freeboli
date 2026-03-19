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

export async function sendDailySummary(stats: {
  newUsers: number;
  activeUsers: number;
  totalBets: number;
  totalFaucetClaims: number;
  withdrawalRequests: number;
  depositCount: number;
  platformBalance: number;
}) {
  const text = `📊 <b>Resumen diario</b>

👤 Usuarios nuevos: ${stats.newUsers}
🟢 Usuarios activos: ${stats.activeUsers}
🎰 Apuestas HI-LO: ${stats.totalBets}
🚰 Reclamos faucet: ${stats.totalFaucetClaims}
💸 Retiros solicitados: ${stats.withdrawalRequests}
💰 Depósitos: ${stats.depositCount}
📈 Balance plataforma: ${stats.platformBalance.toLocaleString()} pts`;

  return await sendTelegramMessage(text, "info");
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 3)}***@${domain}`;
}
