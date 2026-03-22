/**
 * Plantillas HTML para correos de FreeBoli
 */

const BASE_STYLE = `
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #e2e8f0;
  background-color: #0f172a;
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
  border-radius: 12px;
`;

// Mapa de colores por nivel (debe ser inline para clientes de correo)
const LEVEL_COLORS: Record<number, { text: string; bg: string; border: string; bar: string }> = {
  1: { text: "#94a3b8", bg: "#1e293b", border: "#334155", bar: "#64748b" },
  2: { text: "#38bdf8", bg: "#0f2033", border: "#0c4a6e", bar: "#0ea5e9" },
  3: { text: "#60a5fa", bg: "#0f1c33", border: "#1e3a5f", bar: "#3b82f6" },
  4: { text: "#c084fc", bg: "#1a0a29", border: "#4c1d95", bar: "#a855f7" },
  5: { text: "#34d399", bg: "#0a2018", border: "#065f46", bar: "#10b981" },
  6: { text: "#fbbf24", bg: "#1c1100", border: "#78350f", bar: "#f59e0b" },
  7: { text: "#f87171", bg: "#200a0a", border: "#7f1d1d", bar: "#ef4444" },
};

const CARD_STYLE = `
  background-color: #1e293b;
  padding: 25px;
  border-radius: 10px;
  border: 1px solid #334155;
`;

const BUTTON_STYLE = `
  display: inline-block;
  padding: 12px 24px;
  background-color: #3b82f6;
  color: #ffffff;
  text-decoration: none;
  border-radius: 6px;
  font-weight: bold;
  margin-top: 20px;
`;

export function getNewLevelsConfigEmail(): string {
  return `
    <div style="${BASE_STYLE}">
      <div style="${CARD_STYLE}">
        <h1 style="color: #60a5fa; margin-top: 0;">🚀 ¡Nuevos Niveles en FreeBoli!</h1>
        <p>Hola de parte del equipo de FreeBoli,</p>
        <p>Hemos rediseñado por completo nuestro sistema de niveles para premiar tu lealtad y actividad.</p>
        <p><strong>¿Qué hay de nuevo?</strong></p>
        <ul>
          <li><strong>Nivel Jugador más rápido:</strong> ¡Ahora puedes alcanzarlo en tu primer día!</li>
          <li><strong>Mayores límites:</strong> Hasta 1,000,000 de puntos por apuesta y 1,000 BOLIS de retiro para Leyendas.</li>
          <li><strong>Nuevos retos:</strong> Ahora contamos tus predicciones y tus rachas consecutivas para subir de rango.</li>
        </ul>
        <p>Entra ahora y descubre tu nuevo potencial.</p>
        <a href="https://freeboli.win/cuenta" style="${BUTTON_STYLE}">Ver mi Nivel</a>
      </div>
      <p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 20px;">
        Este es un correo informativo sobre cambios en la plataforma.
      </p>
    </div>
  `;
}

export function getLevelUpEmail(userName: string, levelName: string, icon: string, benefits: string[]): string {
  return `
    <div style="${BASE_STYLE}">
      <div style="${CARD_STYLE}; text-align: center;">
        <h1 style="color: #facc15; margin-top: 0;">🎉 ¡Felicidades, ${userName}!</h1>
        <div style="font-size: 60px; margin: 20px 0;">${icon}</div>
        <h2 style="color: #ffffff;">Has ascendido al nivel: <span style="color: #60a5fa;">${levelName}</span></h2>
        <p>Tu constancia ha dado sus frutos. Por subir de nivel, has desbloqueado los siguientes beneficios:</p>
        <div style="text-align: left; background: #0f172a; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <ul style="margin: 0; padding-left: 20px;">
            ${benefits.map(b => `<li style="margin-bottom: 8px;">${b}</li>`).join('')}
          </ul>
        </div>
        <p>¡Sigue jugando y subiendo hacia la cima!</p>
        <a href="https://freeboli.win/faucet" style="${BUTTON_STYLE}">¡Ir a jugar ahora!</a>
      </div>
    </div>
  `;
}

export function getUserStatusEmail(userName: string, levelName: string, stats: any): string {
  return `
    <div style="${BASE_STYLE}">
      <div style="${CARD_STYLE}">
        <h2 style="color: #ffffff; margin-top: 0;">Tu Estatus Actual en FreeBoli</h2>
        <p>Hola <strong>${userName}</strong>, aquí tienes un resumen de tu progreso actual:</p>
        <div style="background: #0f172a; padding: 15px; border-radius: 8px;">
          <p style="margin: 5px 0;">Nivel actual: <strong>${levelName}</strong></p>
          <p style="margin: 5px 0;">Apuestas HI-LO: <strong>${stats.hilo_bet_count}</strong></p>
          <p style="margin: 5px 0;">Reclamos Faucet: <strong>${stats.faucet_claim_count}</strong></p>
          <p style="margin: 5px 0;">Predicciones: <strong>${stats.prediction_count}</strong></p>
          <p style="margin: 5px 0;">Mejor Racha: <strong>${stats.max_daily_streak} días</strong></p>
        </div>
        <p>¡Todavía te queda mucho por conquistar!</p>
        <a href="https://freeboli.win/clasificacion" style="${BUTTON_STYLE}">Ver Clasificación</a>
      </div>
    </div>
  `;
}

/**
 * Genera una "Player Card" HTML estática optimizada para clientes de correo.
 * Es la representación del widget LevelProgressCard, sin JS.
 */
export function getLevelCardEmail(params: {
  userName: string;
  levelLevel: number;
  levelName: string;
  levelIcon: string;
  xpPercent: number;
  maxBetPoints: number;
  maxWithdrawBolis: number;
  rewardPoints: number;
  nextLevelName?: string;
  nextLevelIcon?: string;
  benefits?: string[];
}): string {
  const {
    userName, levelLevel, levelName, levelIcon, xpPercent,
    maxBetPoints, maxWithdrawBolis, rewardPoints, nextLevelName, nextLevelIcon, benefits = []
  } = params;

  const c = LEVEL_COLORS[levelLevel] ?? LEVEL_COLORS[1];
  const barWidth = Math.min(Math.max(xpPercent, 3), 100);

  const benefitRows = benefits.map(b => `
    <tr>
      <td style="padding: 4px 0; font-size: 13px; color: #e2e8f0;">✅ ${b}</td>
    </tr>
  `).join('');

  return `
    <div style="${BASE_STYLE}">
      <!-- PLAYER CARD -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background: ${c.bg}; border: 2px solid ${c.border}; border-radius: 16px; overflow: hidden; box-shadow: 0 0 30px ${c.border};">
        <tr>
          <!-- Header -->
          <td style="padding: 24px; background: linear-gradient(135deg, ${c.bg}, #0f172a);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width: 64px; font-size: 48px; text-align: center; vertical-align: middle;">${levelIcon}</td>
                <td style="padding-left: 16px; vertical-align: middle;">
                  <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">FreeBoli · Nivel ${levelLevel}</div>
                  <div style="font-size: 26px; font-weight: 900; color: ${c.text}; margin: 0;">${levelName}</div>
                  <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Jugador: <strong style="color: #e2e8f0;">${userName}</strong></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <!-- XP Bar -->
          <td style="padding: 0 24px 20px;">
            ${nextLevelName ? `
              <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
                Progreso hacia <strong style="color: ${c.text};">${nextLevelIcon ?? ''} ${nextLevelName}</strong>
                <span style="float: right; color: #e2e8f0; font-weight: bold;">${xpPercent}%</span>
              </div>
            ` : `<div style="font-size: 11px; color: #ef4444; font-weight: bold; margin-bottom: 6px;">🔥 NIVEL MÁXIMO ALCANZADO</div>`}
            <!-- Fondo barra -->
            <div style="height: 12px; background: #1e293b; border-radius: 6px; overflow: hidden; border: 1px solid #334155;">
              <!-- Relleno barra -->
              <div style="height: 12px; width: ${barWidth}%; background: linear-gradient(90deg, #3b82f6, ${c.bar}); border-radius: 6px;"></div>
            </div>
          </td>
        </tr>
        <tr>
          <!-- Benefits grid -->
          <td style="padding: 0 24px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width: 50%; padding: 10px; background: #0f172a; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                  <div style="font-size: 10px; color: #64748b; margin-bottom: 4px;">APUESTA MÁX.</div>
                  <div style="font-size: 18px; font-weight: 900; color: #fbbf24;">${maxBetPoints.toLocaleString()}</div>
                  <div style="font-size: 10px; color: #64748b;">puntos</div>
                </td>
                <td style="width: 8px;"></td>
                <td style="width: 50%; padding: 10px; background: #0f172a; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                  <div style="font-size: 10px; color: #64748b; margin-bottom: 4px;">RETIRO MÁX.</div>
                  <div style="font-size: 18px; font-weight: 900; color: #34d399;">${maxWithdrawBolis}</div>
                  <div style="font-size: 10px; color: #64748b;">BOLIS</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${benefits.length > 0 ? `
        <tr>
          <td style="padding: 0 24px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${benefitRows}
            </table>
          </td>
        </tr>
        ` : ''}
        ${rewardPoints > 0 ? `
        <tr>
          <td style="padding: 12px 24px; background: #052e16; border-top: 1px solid #065f46;">
            <p style="margin: 0; font-size: 13px; color: #34d399; text-align: center;">
              🎁 Premio acreditado: <strong>+${rewardPoints.toLocaleString()} puntos</strong>
            </p>
          </td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 16px 24px; text-align: center; background: #0f172a;">
            <a href="https://freeboli.win/clasificacion" style="display: inline-block; padding: 10px 28px; background: ${c.bar}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
              Ver mi Progreso 🏆
            </a>
          </td>
        </tr>
      </table>
    </div>
  `;
}
