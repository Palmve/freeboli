"use client";

/**
 * Página de administración que despliega todos los sistemas de seguridad
 * y antibot implantados en la plataforma.
 */

const SYSTEMS = [
  {
    id: "captcha",
    title: "CAPTCHA (cuentas matemáticas)",
    description: "Cada N reclamos del faucet se exige resolver una operación matemática simple (+, -, ×). El token está firmado (HMAC) y tiene caducidad de 5 minutos. Evita bots que reclaman automáticamente.",
    where: "Faucet (POST /api/faucet)",
    config: "CAPTCHA_INTERVAL (cada cuántos reclamos; ej. 4)",
    status: "Activo",
  },
  {
    id: "ip-sessions",
    title: "Límite de sesiones por IP",
    description: "Máximo de cuentas distintas que pueden usar la misma IP. Si se supera, no se permite reclamar el faucet desde esa IP hasta que se liberen sesiones. La IP se guarda como hash SHA-256 (no en claro).",
    where: "Faucet (POST /api/faucet)",
    config: "MAX_SESSIONS_PER_IP (ej. 3)",
    status: "Activo",
  },
  {
    id: "email-verified",
    title: "Verificación de correo para faucet",
    description: "Solo se puede reclamar el faucet si el usuario ha verificado su correo mediante el enlace enviado por email. Reduce cuentas desechables y bots.",
    where: "Faucet (POST /api/faucet)",
    config: "—",
    status: "Activo",
  },
  {
    id: "engagement",
    title: "Engagement HI-LO (anti-farm)",
    description: "Cada N reclamos del faucet se exige haber jugado al menos 1 partida de HI-LO en las últimas 24 horas. Obliga a interacción real y reduce farming solo de faucet.",
    where: "Faucet (POST /api/faucet)",
    config: "FAUCET_ENGAGEMENT_EVERY (ej. 10)",
    status: "Activo",
  },
  {
    id: "cooldown",
    title: "Cooldown del faucet",
    description: "Tiempo mínimo entre dos reclamos del mismo usuario. Si intenta reclamar antes, recibe 429 con segundos restantes.",
    where: "Faucet (POST /api/faucet)",
    config: "FAUCET_COOLDOWN_HOURS (ej. 1)",
    status: "Activo",
  },
  {
    id: "user-status",
    title: "Estados de usuario (suspendido / bloqueado)",
    description: "Los perfiles tienen status: normal, evaluar, suspendido, bloqueado. Suspendido y bloqueado no pueden reclamar faucet, jugar HI-LO ni solicitar retiros. El admin puede cambiar el status desde Usuarios.",
    where: "Faucet, HI-LO (play), Retiros (POST /api/withdraw)",
    config: "— (Admin → Usuarios)",
    status: "Activo",
  },
  {
    id: "register-rate",
    title: "Rate limit en registro",
    description: "Límite por IP: máximo 3 intentos en 15 minutos y máximo 5 registros en 24 horas. Evita oleadas de cuentas desde la misma IP.",
    where: "Registro (POST /api/auth/register)",
    config: "— (código: rate-limit)",
    status: "Activo",
  },
  {
    id: "honeypot",
    title: "Campo honeypot en registro",
    description: "Campo oculto en el formulario de registro. Si el cliente lo rellena, se considera bot y se devuelve éxito falso sin crear cuenta.",
    where: "Registro (POST /api/auth/register)",
    config: "—",
    status: "Activo",
  },
  {
    id: "timing-register",
    title: "Tiempo mínimo en formulario de registro",
    description: "Si el formulario se envía en menos de 3 segundos desde que se cargó, se rechaza. Los humanos suelen tardar más; los bots envían al instante.",
    where: "Registro (POST /api/auth/register)",
    config: "— (3 s)",
    status: "Activo",
  },
  {
    id: "disposable-email",
    title: "Bloqueo de correos desechables",
    description: "Se rechaza el registro con dominios de correo temporal (tempmail, guerrillamail, mailinator, etc.) para evitar cuentas de un solo uso.",
    where: "Registro (POST /api/auth/register)",
    config: "— (lista en lib/disposable-emails)",
    status: "Activo",
  },
  {
    id: "withdraw-rate",
    title: "Rate limit en retiros",
    description: "Máximo 5 solicitudes de retiro por usuario por hora. Evita abuso y automatización de retiros.",
    where: "Retiros (POST /api/withdraw)",
    config: "— (5 por hora por usuario)",
    status: "Activo",
  },
  {
    id: "terms-hilo",
    title: "Aceptación de términos para HI-LO",
    description: "Para jugar HI-LO el usuario debe haber aceptado los términos y condiciones. Se guarda en user_terms_acceptances.",
    where: "HI-LO (POST /api/hi-lo/play)",
    config: "—",
    status: "Activo",
  },
  {
    id: "ip-hash",
    title: "IP hasheada (privacidad)",
    description: "La IP no se almacena en claro; se usa un hash SHA-256 para sesiones y rate limits. Reduce exposición de datos personales.",
    where: "session_ips, registro, rate limit",
    config: "—",
    status: "Activo",
  },
  {
    id: "admin-emails",
    title: "Acceso admin por lista de emails",
    description: "Solo los emails listados en ADMIN_EMAILS pueden acceder al panel de administración. La comprobación se hace en sesión (isAdmin).",
    where: "Layout admin, APIs /api/admin/*",
    config: "ADMIN_EMAILS (env)",
    status: "Activo",
  },
];

export default function SeguridadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Seguridad y antibot</h2>
        <p className="text-sm text-slate-400 mt-1">
          Sistemas de seguridad y protección antibot implantados en la plataforma. Los parámetros numéricos (límites por IP, rate limits, tiempo mínimo en formulario, etc.) se modifican en{" "}
          <a href="/admin/configuracion" className="text-amber-400 hover:underline">Configuración</a>, grupo <strong>Seguridad</strong>, con valor por defecto y nota en cada uno.
        </p>
      </div>

      <div className="grid gap-4">
        {SYSTEMS.map((s) => (
          <div
            key={s.id}
            className="card border border-slate-700/80 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-amber-400">{s.title}</h3>
              <span className="shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                {s.status}
              </span>
            </div>
            <p className="text-sm text-slate-300">{s.description}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="text-slate-500">
                <strong className="text-slate-400">Dónde:</strong> {s.where}
              </span>
              <span className="text-slate-500">
                <strong className="text-slate-400">Config:</strong> {s.config}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
