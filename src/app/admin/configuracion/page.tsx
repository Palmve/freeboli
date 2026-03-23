"use client";

import { useEffect, useState } from "react";

interface SettingField {
  key: string;
  label: string;
  type: "number" | "json";
  description: string;
  group: string;
  /** Valor por defecto (se muestra como nota y se usa si no hay valor en BD) */
  defaultValue?: string;
}

const FIELDS: SettingField[] = [
  { key: "FAUCET_POINTS", label: "Puntos base faucet", type: "number", description: "Puntos que se otorgan por cada reclamo base", group: "Faucet", defaultValue: "100" },
  { key: "FAUCET_COOLDOWN_HOURS", label: "Cooldown (horas)", type: "number", description: "Horas entre cada reclamo del faucet", group: "Faucet", defaultValue: "1" },
  { key: "CAPTCHA_INTERVAL", label: "CAPTCHA cada N reclamos", type: "number", description: "Cada cuántos reclamos se pide CAPTCHA", group: "Faucet", defaultValue: "4" },
  { key: "FAUCET_ENGAGEMENT_EVERY", label: "Engagement cada N reclamos", type: "number", description: "Cada cuántos reclamos se exige haber jugado HI-LO en las últimas 24h", group: "Faucet", defaultValue: "10" },
  { key: "AFFILIATE_COMMISSION_PERCENT", label: "Comisión afiliados (%)", type: "number", description: "Porcentaje de comisión sobre faucet y juegos", group: "Afiliados" },
  { key: "AFFILIATE_ACHIEVEMENT_PERCENT", label: "Comisión logros (%)", type: "number", description: "Porcentaje de comisión sobre logros del referido", group: "Afiliados" },
  { key: "REFERRAL_VERIFIED_BONUS", label: "Bonus referido verificado", type: "number", description: "Puntos que gana el referente cuando el referido cumple los requisitos", group: "Afiliados" },
  { key: "REFERRAL_MIN_BETS", label: "Mín. apuestas para bonus", type: "number", description: "Apuestas HI-LO mínimas que debe tener el referido para dar bonus", group: "Afiliados" },
  { key: "REFERRAL_MIN_DAYS", label: "Mín. días para bonus", type: "number", description: "Días mínimos de registro del referido para dar bonus", group: "Afiliados" },
  { key: "HOURLY_STREAK_TIERS", label: "Tiers racha por horas", type: "json", description: "JSON array con min, max, multiplier", group: "Streaks" },
  { key: "DAILY_STREAK_TIERS", label: "Tiers racha por días", type: "json", description: "JSON array con min, max, bonus", group: "Streaks" },
  { key: "PRIZE_DAILY_1", label: "Premio diario 1er lugar", type: "number", description: "Puntos para el 1er lugar del ranking diario", group: "Premios Ranking" },
  { key: "PRIZE_DAILY_2", label: "Premio diario 2do lugar", type: "number", description: "Puntos para el 2do lugar del ranking diario", group: "Premios Ranking" },
  { key: "PRIZE_DAILY_3", label: "Premio diario 3er lugar", type: "number", description: "Puntos para el 3er lugar del ranking diario", group: "Premios Ranking" },
  { key: "PRIZE_WEEKLY_1", label: "Premio semanal 1er lugar", type: "number", description: "Puntos para el 1er lugar del ranking semanal", group: "Premios Ranking" },
  { key: "PRIZE_WEEKLY_2", label: "Premio semanal 2do lugar", type: "number", description: "Puntos para el 2do lugar del ranking semanal", group: "Premios Ranking" },
  { key: "PRIZE_WEEKLY_3", label: "Premio semanal 3er lugar", type: "number", description: "Puntos para el 3er lugar del ranking semanal", group: "Premios Ranking" },
  { key: "PRIZE_MONTHLY_1", label: "Premio mensual 1er lugar", type: "number", description: "Puntos para el 1er lugar del ranking mensual", group: "Premios Ranking" },
  { key: "PRIZE_MONTHLY_2", label: "Premio mensual 2do lugar", type: "number", description: "Puntos para el 2do lugar del ranking mensual", group: "Premios Ranking" },
  { key: "PRIZE_MONTHLY_3", label: "Premio mensual 3er lugar", type: "number", description: "Puntos para el 3er lugar del ranking mensual", group: "Premios Ranking" },
  { key: "MAX_BET_POINTS", label: "Apuesta maxima (pts)", type: "number", description: "Maximo de puntos que un usuario puede apostar en una jugada", group: "Limites de Juego" },
  { key: "MAX_WIN_POINTS", label: "Ganancia maxima/jugada (pts)", type: "number", description: "Maximo de puntos que un usuario puede ganar en una jugada", group: "Limites de Juego" },
  { key: "MAX_DAILY_WIN_POINTS", label: "Ganancia maxima/dia (pts)", type: "number", description: "Maximo de puntos que un usuario puede ganar en un dia", group: "Limites de Juego" },
  // Seguridad y antibot (todos con valor por defecto y nota)
  { key: "MAX_SESSIONS_PER_IP", label: "Máx. sesiones por IP", type: "number", description: "Máximo de cuentas distintas que pueden usar la misma IP para reclamar faucet. Más bajo = más estricto.", group: "Seguridad", defaultValue: "3" },
  { key: "REGISTER_BURST_MAX", label: "Registro: máx. intentos (ráfaga)", type: "number", description: "Máximo de intentos de registro por IP en la ventana de ráfaga.", group: "Seguridad", defaultValue: "3" },
  { key: "REGISTER_BURST_WINDOW_MINUTES", label: "Registro: ventana ráfaga (min)", type: "number", description: "Duración en minutos de la ventana de ráfaga para registro.", group: "Seguridad", defaultValue: "15" },
  { key: "REGISTER_DAILY_MAX", label: "Registro: máx. por día por IP", type: "number", description: "Máximo de registros exitosos por IP en 24 h.", group: "Seguridad", defaultValue: "5" },
  { key: "REGISTER_DAILY_WINDOW_HOURS", label: "Registro: ventana diaria (horas)", type: "number", description: "Ventana en horas para el límite diario de registros (normalmente 24).", group: "Seguridad", defaultValue: "24" },
  { key: "REGISTER_MIN_SECONDS", label: "Registro: tiempo mín. en formulario (s)", type: "number", description: "Si el formulario se envía en menos de este tiempo, se rechaza (anti-bot).", group: "Seguridad", defaultValue: "3" },
  { key: "ENABLE_DISPOSABLE_BLOCK", label: "Bloquear correos desechables", type: "number", description: "1 = bloquear dominios tempmail/guerrillamail etc.; 0 = permitir.", group: "Seguridad", defaultValue: "1" },
  { key: "WITHDRAW_RATE_MAX", label: "Retiros: máx. solicitudes por ventana", type: "number", description: "Máximo de solicitudes de retiro por usuario en la ventana.", group: "Seguridad", defaultValue: "5" },
  { key: "WITHDRAW_RATE_WINDOW_HOURS", label: "Retiros: ventana (horas)", type: "number", description: "Ventana en horas para el límite de solicitudes de retiro por usuario.", group: "Seguridad", defaultValue: "1" },
  // Predicciones
  { key: "BTC_MAX_BET", label: "BTC: Apuesta máxima", type: "number", description: "Límite de puntos para BTC", group: "Predicciones (BTC)", defaultValue: "10000" },
  { key: "SOL_MAX_BET", label: "SOL: Apuesta máxima", type: "number", description: "Límite de puntos para SOL", group: "Predicciones (SOL)", defaultValue: "10000" },
  { key: "BOLIS_MAX_BET", label: "BOLIS: Apuesta máxima", type: "number", description: "Límite de puntos para BOLIS", group: "Predicciones (BOLIS)", defaultValue: "10000" },
  { key: "PREDICTION_HOUSE_EDGE", label: "Comisión Casa (%)", type: "number", description: "Porcentaje de comisión (0.05 = 5%)", group: "Predicciones (General)", defaultValue: "0.05" },
  { key: "PREDICTION_CUTOFF_SECONDS", label: "Tiempo de Cierre (s)", type: "number", description: "Segundos antes del fin de hora para cerrar (600 = 10 min)", group: "Predicciones (General)", defaultValue: "600" },
  // Soporte
  { key: "TELEGRAM_BOT_TOKEN", label: "Telegram Bot Token", type: "text" as any, description: "Token del bot para notificaciones de soporte", group: "Soporte" },
  { key: "TELEGRAM_CHAT_ID", label: "Telegram Chat ID", type: "text" as any, description: "ID del chat/usuario donde llegarán los avisos", group: "Soporte" },
];

export default function ConfiguracionPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then((r) => r.json())
      .then((d) => {
        const vals: Record<string, string> = {};
        for (const field of FIELDS) {
          const raw = (d.settings ?? {})[field.key];
          if (raw !== undefined && raw !== null) {
            vals[field.key] = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
          } else if (field.defaultValue !== undefined) {
            vals[field.key] = field.defaultValue;
          }
        }
        for (const [key, val] of Object.entries(d.settings ?? {})) {
          if (FIELDS.some((f) => f.key === key)) continue;
          vals[key] = typeof val === "object" ? JSON.stringify(val, null, 2) : String(val);
        }
        setValues(vals);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const settings: Record<string, unknown> = {};
    for (const field of FIELDS) {
      const val = values[field.key];
      if (val === undefined || val === "") continue;
      if (field.type === "number") {
        settings[field.key] = Number(val);
      } else if ((field.type as string) === "text") {
        settings[field.key] = val; // Se enviará como string, Supabase lo guardará como JSONB string
      } else {
        try {
          settings[field.key] = JSON.parse(val);
        } catch {
          setMessage(`Error en JSON de ${field.label}`);
          setSaving(false);
          return;
        }
      }
    }

    const res = await fetch("/api/admin/site-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    setMessage(json.ok ? "Configuración guardada" : json.errors?.join(", ") || "Error al guardar");
  }

  // --- Reward templates editor ---
  const [templates, setTemplates] = useState<{ id: string; code: string; name: string; points_reward: number }[]>([]);
  const [templateEdits, setTemplateEdits] = useState<Record<string, string>>({});
  const [templateMsg, setTemplateMsg] = useState("");

  useEffect(() => {
    fetch("/api/rewards/claim")
      .then(() => {})
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (loading) return;
    fetch("/api/admin/reward-templates")
      .then((r) => r.json())
      .then((d) => {
        if (d.templates) {
          setTemplates(d.templates);
          const edits: Record<string, string> = {};
          for (const t of d.templates) edits[t.id] = String(t.points_reward);
          setTemplateEdits(edits);
        }
      })
      .catch(() => {});
  }, [loading]);

  async function saveTemplates() {
    setTemplateMsg("");
    const updates = templates.map((t) => ({
      id: t.id,
      points_reward: Number(templateEdits[t.id] ?? t.points_reward),
    }));

    const res = await fetch("/api/admin/reward-templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    const json = await res.json().catch(() => ({}));
    setTemplateMsg(json.ok ? "Logros actualizados" : "Error al guardar logros");
  }

  const groups = [...new Set(FIELDS.filter(f => f.group !== "Soporte").map((f) => f.group)), "Soporte"];
  const [activeTab, setActiveTab] = useState(groups[0]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Niveles
  const [autoLevelNotify, setAutoLevelNotify] = useState(true);
  const [levelMsg, setLevelMsg] = useState("");
  const [levelSending, setLevelSending] = useState(false);

  // Seguridad
  const [secEvents, setSecEvents] = useState<any[]>([]);
  const [loadingSec, setLoadingSec] = useState(false);

  // Tickets
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    if (activeTab === "Seguridad") {
      setLoadingSec(true);
      fetch("/api/admin/security-events")
        .then(r => r.json())
        .then(d => setSecEvents(d.events || []))
        .catch(() => {})
        .finally(() => setLoadingSec(false));
    }
    if (activeTab === "Tickets") {
      setLoadingTickets(true);
      fetch("/api/admin/support-tickets")
        .then(r => r.json())
        .then(d => setTickets(d.tickets || []))
        .finally(() => setLoadingTickets(false));
    }
  }, [activeTab]);

  if (loading) return <div className="py-20 text-center text-slate-400">Cargando configuración...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 lg:flex">
      {/* Sidebar / Mobile Menu */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-slate-900 border-r border-slate-800 transition-transform lg:relative lg:translate-x-0 ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Ajustes
          </h2>
          <nav className="space-y-1">
            {groups.map((group) => (
              <button
                key={group}
                onClick={() => { setActiveTab(group); setIsMenuOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === group ? "bg-amber-500 text-slate-900 font-bold shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
              >
                {group}
              </button>
            ))}
            <button
              onClick={() => { setActiveTab("Logros"); setIsMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "Logros" ? "bg-amber-500 text-slate-900 font-bold shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
            >
              Valor de Logros
            </button>
            <button
              onClick={() => { setActiveTab("Tickets"); setIsMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "Tickets" ? "bg-amber-500 text-slate-900 font-bold shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
            >
              Tickets Soporte
            </button>
            <button
              onClick={() => { setActiveTab("Seguridad"); setIsMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "Seguridad" ? "bg-amber-500 text-slate-900 font-bold shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
            >
              🛡️ Seguridad
            </button>
            <button
              onClick={() => { setActiveTab("Niveles"); setIsMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "Niveles" ? "bg-amber-500 text-slate-900 font-bold shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
            >
              📊 Niveles y Emails
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-10 max-w-4xl">
        <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-white">{activeTab}</h1>
              <p className="text-slate-400 mt-1">Configuración detallada de la sección.</p>
            </div>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-2 rounded-lg bg-slate-800 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
            </button>
        </header>

        {message && (
          <div className={`mb-6 rounded-xl p-4 flex items-center gap-3 border ${message.includes("Error") ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
            <span className="text-xl">{message.includes("Error") ? "❌" : "✅"}</span>
            <p className="font-medium">{message}</p>
          </div>
        )}

        <div className="space-y-6">
          {activeTab === "Logros" ? (
             <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="p-6 space-y-4">
                        {templates.map((t) => (
                          <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                            <div>
                              <p className="font-bold text-white">{t.name}</p>
                              <code className="text-[10px] text-amber-500/70 font-mono">{t.code}</code>
                            </div>
                            <input
                              type="number"
                              value={templateEdits[t.id] ?? ""}
                              onChange={(e) => setTemplateEdits((v) => ({ ...v, [t.id]: e.target.value }))}
                              className="w-full sm:w-32 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-right font-mono text-white focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                        ))}
                    </div>
                </div>
                <button onClick={saveTemplates} className="w-full py-4 bg-slate-100 text-slate-900 font-black rounded-2xl hover:bg-white transition shadow-xl">
                    Sincronizar Logros
                </button>
             </section>
          ) : activeTab === "Tickets" ? (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {loadingTickets ? (
                  <div className="p-10 text-center text-slate-500">Cargando tickets...</div>
                ) : tickets.length === 0 ? (
                  <div className="p-10 text-center text-slate-500">No hay tickets pendientes.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800/50 text-slate-400 text-left">
                          <th className="px-6 py-4 font-bold uppercase tracking-tighter">Usuario</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-tighter">Asunto</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-tighter">Fecha</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-tighter text-right">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {tickets.map((t: any) => (
                          <tr key={t.id} className="hover:bg-slate-800/30 transition">
                            <td className="px-6 py-4">
                              <p className="text-white font-bold">{t.user_email || "Anónimo"}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{t.id}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                                  t.type === 'dispute' ? 'bg-red-500/20 text-red-400' :
                                  t.type === 'delay' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {t.type}
                                </span>
                                <span className="text-slate-200 font-semibold">{t.subject}</span>
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-2">{t.message}</p>
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                              {new Date(t.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${t.status === 'open' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-500'}`}>
                                {t.status === 'open' ? 'Pendiente' : 'Cerrado'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          ) : activeTab === "Seguridad" ? (
            <section className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">🛡️ Eventos de Seguridad Recientes</h3>
                  <button
                    onClick={() => {
                      setLoadingSec(true);
                      fetch("/api/admin/security-events").then(r => r.json()).then(d => setSecEvents(d.events || [])).finally(() => setLoadingSec(false));
                    }}
                    className="text-xs text-slate-400 hover:text-white transition"
                  >↻ Actualizar</button>
                </div>
                {loadingSec ? (
                  <div className="p-8 text-center text-slate-500">Cargando eventos...</div>
                ) : secEvents.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">✅ Sin eventos de seguridad recientes.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-800/50 text-slate-400 text-left uppercase">
                          <th className="px-4 py-3">Severidad</th>
                          <th className="px-4 py-3">Evento</th>
                          <th className="px-4 py-3">Usuario</th>
                          <th className="px-4 py-3 text-right">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {secEvents.map((e: any) => (
                          <tr key={e.id} className="hover:bg-slate-800/20 transition">
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                e.severity === 'critical' ? 'bg-red-600 text-white' :
                                e.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                e.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-slate-700 text-slate-400'
                              }`}>{e.severity}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-300 font-mono">{e.event_type}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[10px] truncate max-w-[120px]">{e.user_id ?? '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                              {new Date(e.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          ) : activeTab === "Niveles" ? (
            <section className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Toggle Auto-Envío */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-base font-bold text-white mb-1">📧 Auto-Envío al Cambiar de Nivel</h3>
                <p className="text-sm text-slate-400 mb-4">Cuando está activo, el sistema envía la tarjeta de nivel al usuario cada vez que asciende de rango.</p>
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${autoLevelNotify ? "text-emerald-400" : "text-slate-500"}`}>
                    {autoLevelNotify ? "🟢 Activo" : "🔴 Desactivado"}
                  </span>
                  <button
                    onClick={() => setAutoLevelNotify(!autoLevelNotify)}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${autoLevelNotify ? "bg-emerald-500" : "bg-slate-700"}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${autoLevelNotify ? "translate-x-8" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>

              {/* Tabla de Niveles */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white">Configuración de Niveles</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-800/50 text-slate-400 text-left uppercase tracking-tight">
                        <th className="px-4 py-3">Rango</th>
                        <th className="px-4 py-3 text-center">HI-LO</th>
                        <th className="px-4 py-3 text-center">Faucet</th>
                        <th className="px-4 py-3 text-center">Días</th>
                        <th className="px-4 py-3 text-center">Premio</th>
                        <th className="px-4 py-3 text-center">Apuesta Máx.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {[
                        { level: 1, name: "Novato", icon: "🥉", minBets: 0, minFaucet: 0, minDaysSinceJoined: 0, rewardPoints: 0, maxBet: 10000 },
                        { level: 2, name: "Aprendiz", icon: "🥈", minBets: 5, minFaucet: 3, minDaysSinceJoined: 0, rewardPoints: 0, maxBet: 25000 },
                        { level: 3, name: "Jugador", icon: "🥇", minBets: 20, minFaucet: 10, minDaysSinceJoined: 1, rewardPoints: 0, maxBet: 50000 },
                        { level: 4, name: "Veterano", icon: "⭐", minBets: 200, minFaucet: 30, minDaysSinceJoined: 7, rewardPoints: 1000, maxBet: 100000 },
                        { level: 5, name: "Experto", icon: "💎", minBets: 1000, minFaucet: 60, minDaysSinceJoined: 30, rewardPoints: 5000, maxBet: 250000 },
                        { level: 6, name: "Maestro", icon: "👑", minBets: 5000, minFaucet: 100, minDaysSinceJoined: 90, rewardPoints: 25000, maxBet: 500000 },
                        { level: 7, name: "Leyenda", icon: "🔥", minBets: 10000, minFaucet: 200, minDaysSinceJoined: 180, rewardPoints: 100000, maxBet: 1000000 },
                      ].map((l) => (
                        <tr key={l.level} className="hover:bg-slate-800/20 transition">
                          <td className="px-4 py-3 font-bold">{l.icon} {l.name}</td>
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">{l.minBets.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">{l.minFaucet}</td>
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">{l.minDaysSinceJoined > 0 ? `${l.minDaysSinceJoined}d` : "-"}</td>
                          <td className="px-4 py-3 text-center text-amber-400 font-mono font-bold">{l.rewardPoints > 0 ? `+${l.rewardPoints.toLocaleString()}` : "-"}</td>
                          <td className="px-4 py-3 text-center text-emerald-400 font-mono">{l.maxBet.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Envío Manual Individual */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-base font-bold text-white">📤 Enviar Tarjeta a un Usuario</h3>
                <p className="text-xs text-slate-400">Introduce el User ID para enviar manualmente la tarjeta de nivel actual.</p>
                <div className="flex gap-2">
                  <input id="level-user-id" type="text" placeholder="User ID (UUID)"
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-white font-mono text-sm focus:border-amber-500 focus:outline-none" />
                  <button
                    onClick={async () => {
                      const uid = (document.getElementById('level-user-id') as HTMLInputElement)?.value?.trim();
                      if (!uid) { setLevelMsg("⚠️ Introduce un User ID."); return; }
                      setLevelMsg("Enviando...");
                      const r = await fetch('/api/admin/levels/notify-user', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: uid }) });
                      const d = await r.json();
                      setLevelMsg(d.ok ? `✅ Enviado a ${d.email} (Nivel: ${d.level})` : `❌ ${d.error}`);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition"
                  >Enviar</button>
                </div>
                {levelMsg && <p className="text-sm font-medium text-slate-300 border border-slate-700 rounded-lg px-3 py-2">{levelMsg}</p>}
              </div>

              {/* Envío Masivo */}
              <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-5 space-y-3">
                <h3 className="text-base font-bold text-red-400">📣 Envío Masivo - Anuncio de Niveles</h3>
                <p className="text-xs text-slate-400">Envía la tarjeta de nivel personalizada a TODOS los usuarios registrados con email verificado.</p>
                <button
                  disabled={levelSending}
                  onClick={async () => {
                    if (!confirm("¿Enviar email a TODOS los usuarios? Esta acción puede tardar varios minutos.")) return;
                    setLevelSending(true);
                    setLevelMsg("⏳ Procesando envío masivo...");
                    const r = await fetch('/api/admin/levels/sync-and-notify', { method: 'POST' });
                    const d = await r.json();
                    setLevelSending(false);
                    setLevelMsg(d.ok ? `✅ Completado: ${d.sent} enviados, ${d.errors} errores de ${d.total} usuarios.` : `❌ ${d.error}`);
                  }}
                  className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-bold rounded-xl transition disabled:opacity-50"
                >
                  {levelSending ? "⏳ Enviando a todos los usuarios..." : "🚀 Iniciar Envío Masivo"}
                </button>
              </div>
            </section>
          ) : (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                  {FIELDS.filter((f) => f.group === activeTab).map((field) => (
                    <div key={field.key} className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <label className="text-sm font-black text-slate-300 uppercase tracking-tighter">{field.label}</label>
                        {field.defaultValue !== undefined && (
                          <span className="text-[10px] text-amber-500/60 font-bold uppercase">Por defecto: {field.defaultValue}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{field.description}</p>
                      {field.type === "json" ? (
                        <textarea
                          value={values[field.key] ?? ""}
                          onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          rows={6}
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-sm text-amber-200 focus:border-amber-500 focus:outline-none"
                        />
                      ) : (
                        <input
                          type={field.key.includes("EDGE") || field.key.includes("PERCENT") ? "text" : "number"}
                          value={values[field.key] ?? ""}
                          onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white font-mono focus:border-amber-500 focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                  {activeTab === "Predicciones (General)" && (
                    <div className="pt-4 border-t border-slate-800">
                      <p className="text-xs text-slate-500 mb-4 font-medium italic">
                        Usa este botón si detectas que las apuestas han terminado pero no se han liquidado automáticamente (ganadores/perdedores).
                      </p>
                      <button
                        onClick={async () => {
                          setSaving(true);
                          const res = await fetch("/api/admin/predictions/resolve", { method: "POST" });
                          const d = await res.json();
                          setSaving(false);
                          setMessage(d.success ? `¡Éxito! Se liquidaron ${d.resolved} rondas.` : d.error || "Error al liquidar");
                        }}
                        disabled={saving}
                        className="w-full py-3 bg-slate-800 text-amber-500 font-bold rounded-xl border border-amber-500/30 hover:bg-slate-700 transition"
                      >
                        {saving ? "Procesando..." : "↻ Liquidar Rondas Pendientes Ahora"}
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-amber-500 text-slate-950 font-black rounded-2xl hover:bg-amber-400 transition shadow-xl shadow-amber-500/20 disabled:opacity-50">
                    {saving ? "Guardando cambios..." : "Guardar Ajustes"}
                </button>
            </section>
          )}
        </div>
      </main>

      {/* Overlay mobile */}
      {isMenuOpen && <div onClick={() => setIsMenuOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"></div>}
    </div>
  );
}
