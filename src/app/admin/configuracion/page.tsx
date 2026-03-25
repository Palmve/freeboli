"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getDynamicLevels } from "@/lib/levels";
import InfluencerManager from "../InfluencerManager";


interface SettingField {
  key: string;
  label: string;
  type: "number" | "json" | "text";
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
  { key: "MAX_WIN_POINTS", label: "Ganancia maxima/jugada (pts)", type: "number", description: "Maximo de puntos que un usuario puede ganar en una jugada", group: "Limites de Juego" },
  { key: "MAX_DAILY_WIN_POINTS", label: "Ganancia maxima/dia (pts)", type: "number", description: "Maximo de puntos que un usuario puede ganar en un dia", group: "Limites de Juego", defaultValue: "1000000" },
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
  { key: "WITHDRAWALS_ENABLED", label: "Retiros habilitados (Global)", type: "number", description: "1 = permitir retiros; 0 = BLOQUEAR todos los retiros (Emergencia)", group: "Seguridad", defaultValue: "1" },
  { key: "WITHDRAWAL_AUTO_APPROVE_ENABLED", label: "Retiros automáticos habilitados", type: "number", description: "1 = permitir pagos automáticos; 0 = forzar todas las solicitudes a Pendiente", group: "Seguridad", defaultValue: "0" },
  { key: "MAX_DAILY_AFFILIATE_COMMISSION", label: "Tope diario comisiones referidos (pts)", type: "number", description: "Máximo de puntos que un usuario puede recibir por comisiones de referidos en 24h. Evita el farming entre cuentas propias.", group: "Seguridad", defaultValue: "5000" },
  // Predicciones
  { key: "PREDICTION_HOUSE_EDGE", label: "Comisión Casa (%)", type: "number", description: "Porcentaje de comisión (0.05 = 5%)", group: "Predicciones (General)", defaultValue: "0.05" },
  { key: "PREDICTION_CUTOFF_SECONDS", label: "Tiempo de Cierre (s)", type: "number", description: "Segundos antes del fin de hora para cerrar (600 = 10 min)", group: "Predicciones (General)", defaultValue: "600" },
  // Soporte
  { key: "TELEGRAM_BOT_TOKEN", label: "Telegram Bot Token", type: "text" as any, description: "Token del bot para notificaciones de soporte", group: "Soporte" },
  { key: "TELEGRAM_CHAT_ID", label: "ID de Chat Telegram", type: "text", description: "Chat ID para alertas (numérico)", group: "Soporte" },
  { key: "LEVEL_LIMITS", label: "Sobreescritura de Límites (JSON)", type: "json", description: 'Por nivel: maxBet (pts), maxWithdraw (BOLIS), rewardPoints (premio al alcanzar el nivel). Ej.: { "4": { "maxBet": 5000, "maxWithdraw": 25, "rewardPoints": 1000 } }', group: "Niveles" },
  // Pausar Juegos
  { key: "PAUSE_GAME_BTC_HOURLY", label: "Pausar BTC Hourly", type: "number", description: "1 = Pausado, 0 = Activo", group: "Pausar Juegos", defaultValue: "0" },
  { key: "PAUSE_GAME_BTC_MINI", label: "Pausar BTC Mini", type: "number", description: "1 = Pausado, 0 = Activo", group: "Pausar Juegos", defaultValue: "0" },
  { key: "PAUSE_GAME_BTC_MICRO", label: "Pausar BTC Micro", type: "number", description: "1 = Pausado, 0 = Activo", group: "Pausar Juegos", defaultValue: "0" },
  { key: "PAUSE_GAME_SOL_HOURLY", label: "Pausar SOL Hourly", type: "number", description: "1 = Pausado, 0 = Activo", group: "Pausar Juegos", defaultValue: "0" },
  { key: "PAUSE_GAME_SOL_MINI", label: "Pausar SOL Mini", type: "number", description: "1 = Pausado, 0 = Activo", group: "Pausar Juegos", defaultValue: "0" },
  { key: "PAUSE_GAME_SOL_MICRO", label: "Pausar SOL Micro", type: "number", description: "1 = Pausado, 0 = Activo", group: "Pausar Juegos", defaultValue: "0" },
  { key: "PAUSE_GAME_BOLIS_HOURLY", label: "Pausar BOLIS Hourly", type: "number", description: "1 = Pausado, 0 = Activo", group: "Pausar Juegos", defaultValue: "0" },
  { key: "PAUSE_GAME_BOLIS_MINI", label: "Pausar BOLIS Mini", type: "number", description: "1 = Pausado, 0 = Activo", group: "Pausar Juegos", defaultValue: "0" },
  { key: "PAUSE_GAME_BOLIS_MICRO", label: "Pausar BOLIS Micro", type: "number", description: "1 = Pausado, 0 = Activo", group: "Pausar Juegos", defaultValue: "0" },
  { key: "PAUSE_GAME_HI_LO", label: "Pausar HI-LO", type: "number", description: "1 = Pausado, 0 = Activo", group: "Pausar Juegos", defaultValue: "0" },
];

interface Promotion {
  id: string;
  nombre: string;
  nombre_en?: string;
  palabra: string;
  puntos_totales: number;
  puntos_restantes: number;
  puntos_por_usuario: number;
  link_fuente: string;
  is_active: boolean;
  fecha_inicio: string;
  created_at: string;
}

interface Claim {
  id: string;
  user_id: string;
  points_awarded: number;
  claimed_at: string;
  profiles: {
    email: string;
    name: string;
  };
}

export default function ConfiguracionPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Promociones
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
  const [savingPromo, setSavingPromo] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);

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

  const { data: session } = useSession();
  const permissions = (session?.user as any)?.permissions || {};
  const isSuper = (session?.user as any)?.isSuperAdmin;

  const TABS = [
    { id: "Faucet", label: "Faucet", icon: "⚙️", hidden: !isSuper && !permissions.settings },
    { id: "Afiliados", label: "Afiliados", icon: "⚙️", hidden: !isSuper && !permissions.settings },
    { id: "Streaks", label: "Streaks", icon: "⚙️", hidden: !isSuper && !permissions.settings },
    { id: "Premios Ranking", label: "Premios Ranking", icon: "⚙️", hidden: !isSuper && !permissions.settings },
    { id: "Limites de Juego", label: "Limites de Juego", icon: "⚙️", hidden: !isSuper && !permissions.settings },
    { id: "Logros", label: "🏅 Valor de Logros", icon: "🏅", hidden: !isSuper && !permissions.logros },
    { id: "Predicciones", label: "📈 Predicciones", icon: "📈", hidden: !isSuper && !permissions.predicciones },
    { id: "Tickets", label: "🎫 Tickets Soporte", icon: "🎫", hidden: !isSuper && !permissions.soporte },
    { id: "Seguridad", label: "🛡️ Seguridad", icon: "🛡️", hidden: !isSuper && !permissions.seguridad },
    { id: "Niveles", label: "📊 Niveles y Emails", icon: "📊", hidden: !isSuper && !permissions.levels },
    { id: "Promociones", label: "🎁 Promociones", icon: "🎁", hidden: !isSuper && !permissions.promotions && !permissions.settings },
    { id: "Influencers", label: "🤝 Influencers", icon: "🤝", hidden: !isSuper && !permissions.promotions && !permissions.settings },
    { id: "Pausar Juegos", label: "⏸️ Pausar Juegos", icon: "⏸️", hidden: !isSuper && !permissions.settings },
    { id: "Staff", label: "👥 Agentes", icon: "👥", hidden: !isSuper },
  ].filter(t => !t.hidden);

  const [activeTab, setActiveTab] = useState(TABS[0]?.id || "Faucet");

  // Niveles
  const [autoLevelNotify, setAutoLevelNotify] = useState(true);
  const [levelMsg, setLevelMsg] = useState("");
  const [levelSending, setLevelSending] = useState(false);

  // Seguridad
  const [secEvents, setSecEvents] = useState<any[]>([]);
  const [loadingSec, setLoadingSec] = useState(false);
  const [maintenanceResults, setMaintenanceResults] = useState<any[]>([]);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [lastMaintenance, setLastMaintenance] = useState<string | null>(null);

  // Tickets
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const updateSecurityEvent = async (eventId: string, status: string) => {
    setMessage("");
    try {
      const res = await fetch("/api/admin/security-events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, status }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("Evento de seguridad actualizado.");
        fetch("/api/admin/security-events")
          .then(r => r.json())
          .then(d => setSecEvents(d.events || []));
      } else {
        setMessage("Error: " + data.error);
      }
    } catch {
      setMessage("Error al conectar con la API");
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    setMessage("");
    try {
      const res = await fetch("/api/admin/support-tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("Estado del ticket actualizado con éxito.");
        // Refrescar lista
        fetch("/api/admin/support-tickets")
          .then(r => r.json())
          .then(d => setTickets(d.tickets || []));
      } else {
        setMessage("Error: " + data.error);
      }
    } catch {
      setMessage("Error al conectar con la API");
    }
  };

  const fetchPromotions = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/promociones?t=${Date.now()}`);
      const data = await res.json();
      setPromotions(data.promotions || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchPromoClaims = useCallback(async (promoId: string) => {
    try {
      const res = await fetch(`/api/admin/promociones/claims?promoId=${promoId}&t=${Date.now()}`);
      const data = await res.json();
      setClaims(data.claims || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPromo(true);
    try {
      const res = await fetch("/api/admin/promociones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPromo),
      });
      if (res.ok) {
        fetchPromotions();
        setShowPromoForm(false);
        setEditingPromo(null);
        setMessage("Campaña guardada con éxito.");
      } else {
        setMessage("Error al guardar la campaña.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Error de conexión al guardar campaña.");
    } finally {
      setSavingPromo(false);
    }
  };

  const togglePromoStatus = async (promo: Promotion) => {
    try {
      const res = await fetch("/api/admin/promociones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...promo, is_active: !promo.is_active }),
      });
      if (res.ok) {
        fetchPromotions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json();
      setStaff(data.staff || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

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
    if (activeTab === "Promociones") {
      fetchPromotions();
    }
    if (activeTab === "Staff") {
      fetchStaff();
    }
  }, [activeTab, fetchPromotions, fetchStaff]);

  if (loading) return <div className="py-20 text-center text-slate-400">Cargando configuración...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 lg:flex">
      {/* Sidebar solo escritorio; en móvil se usa el selector debajo del título */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 lg:block">
        <div className="sticky top-0 max-h-screen overflow-y-auto p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Ajustes
          </h2>
          <nav className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${
                  activeTab === tab.id 
                    ? "bg-amber-500 text-slate-900 font-bold shadow-lg shadow-amber-500/20" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span className="text-lg">{tab.icon.split(" ")[0]}</span>
                {tab.label.replace(tab.icon.split(" ")[0], "").trim()}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-10 max-w-4xl">
        <header className="mb-8 space-y-4">
          <div>
            <h1 className="text-3xl font-black text-white">{activeTab}</h1>
            <p className="text-slate-400 mt-1">Configuración detallada de la sección.</p>
          </div>
          <div className="relative lg:hidden">
            <label htmlFor="ajustes-seccion" className="sr-only">
              Sección de ajustes
            </label>
            <select
              id="ajustes-seccion"
              value={TABS.some((t) => t.id === activeTab) ? activeTab : TABS[0]?.id ?? "Faucet"}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full appearance-none rounded-xl border-2 border-slate-700 bg-slate-900 px-4 py-3.5 pr-10 text-[15px] font-bold text-amber-500 shadow-md focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {TABS.map((tab) => (
                <option key={tab.id} value={tab.id} className="bg-slate-900 font-semibold">
                  {tab.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-amber-500" aria-hidden>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
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
                          <th className="px-6 py-4 font-bold uppercase tracking-tighter">Lang</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-tighter">Fecha</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-tighter text-right">Acción</th>
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
                            <td className="px-6 py-4 text-center">
                               <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${t.lang === 'en' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                                 {t.lang || 'es'}
                               </span>
                             </td>
                             <td className="px-6 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                               {new Date(t.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                             </td>
                             <td className="px-6 py-4 text-right">
                               <select
                                 value={t.status}
                                 onChange={(e) => updateTicketStatus(t.id, e.target.value)}
                                 className="bg-slate-800 border-none text-[10px] font-black uppercase tracking-tighter rounded px-2 py-1 outline-none text-slate-300 hover:text-white cursor-pointer transition"
                               >
                                 <option value="open">Pendiente</option>
                                 <option value="approved">Aprobar (Email)</option>
                                 <option value="rejected">Rechazar (Email)</option>
                                 <option value="info_requested">Pedir Info (Email)</option>
                                 <option value="resolved">Resuelto</option>
                                 <option value="closed">Cerrado</option>
                                </select>
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

                {/* Botón de exportación de BD */}
                <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
                  <div>
                    <p className="text-sm text-white font-semibold">📦 Respaldo de Base de Datos</p>
                    <p className="text-[11px] text-slate-500">Descarga JSON de todas las tablas para análisis forense</p>
                  </div>
                  <a
                    href="/api/admin/export-db"
                    download
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-emerald-600/20"
                  >⬇ Descargar BD</a>
                </div>

                {/* Panel de Mantenimiento de BD */}
                <div className="px-5 py-4 border-b border-slate-800 space-y-3 bg-slate-900/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white font-semibold">🛠️ Mantenimiento de Base de Datos</p>
                      <p className="text-[11px] text-slate-500">Purga logs, audita balances y detecta depósitos huérfanos</p>
                    </div>
                    <button
                      disabled={loadingMaintenance}
                      onClick={async () => {
                        setLoadingMaintenance(true);
                        setMaintenanceResults([]);
                        try {
                          const res = await fetch("/api/admin/db-maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
                          const data = await res.json();
                          setMaintenanceResults(data.results || []);
                          setLastMaintenance(data.executed_at ? new Date(data.executed_at).toLocaleString() : null);
                        } finally {
                          setLoadingMaintenance(false);
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-indigo-600/20"
                    >
                      {loadingMaintenance ? "⏳ Ejecutando..." : "▶ Ejecutar Mantenimiento"}
                    </button>
                  </div>
                  {lastMaintenance && <p className="text-[10px] text-slate-500">Ultimo mantenimiento: {lastMaintenance}</p>}
                  {maintenanceResults.length > 0 && (
                    <div className="space-y-1">
                      {maintenanceResults.map((r, i) => (
                        <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] ${
                          r.status === "OK" ? "bg-green-500/10 text-green-400" :
                          r.status === "ALERTA" ? "bg-yellow-500/10 text-yellow-400" :
                          r.status === "SKIP" ? "bg-slate-700/50 text-slate-400" :
                          "bg-red-500/10 text-red-400"
                        }`}>
                          <span>{r.status === "OK" ? "✅" : r.status === "ALERTA" ? "⚠️" : r.status === "SKIP" ? "⏭️" : "❌"}</span>
                          <div><span className="font-bold">{r.task}:</span> {r.detail}</div>
                        </div>
                      ))}
                    </div>
                  )}
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
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {secEvents.map((e: any) => (
                          <tr key={e.id} className="hover:bg-slate-800/20 transition">
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  e.severity === 'critical' ? 'bg-red-600 text-white' :
                                  e.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                  e.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700 text-slate-400'
                                }`}>{e.severity}</span>
                                {e.status && e.status !== 'pending' && (
                                  <span className={`w-fit px-2 py-0.5 rounded text-[9px] font-bold uppercase ${e.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                    {e.status === 'resolved' ? 'Resuelto' : 'Descartado'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-slate-300 font-mono text-[11px] font-bold">{e.event_type}</div>
                              {e.details?.recentCount && <div className="text-[10px] text-slate-500">Frecuencia: {e.details.recentCount} en 24h</div>}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[10px] truncate max-w-[120px]">{e.user_id ?? '—'}</td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {new Date(e.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(!e.status || e.status === 'pending') ? (
                                <div className="flex justify-end gap-1">
                                  <button 
                                    onClick={() => updateSecurityEvent(e.id, 'resolved')}
                                    className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-2 py-1 rounded text-[10px] font-bold border border-emerald-500/30 transition"
                                  >Resolver</button>
                                  <button 
                                    onClick={() => updateSecurityEvent(e.id, 'dismissed')}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded text-[10px] font-bold border border-slate-700 transition"
                                  >Omitir</button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-600 italic">Gestionado</span>
                              )}
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
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* 1. Toggle Auto-Envío */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
                <div>
                  <h3 className="text-base font-bold text-white mb-1">📧 Auto-Envío al Cambiar de Nivel</h3>
                  <p className="text-xs text-slate-400">Notificar al usuario por email cuando asciende de rango.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold uppercase ${autoLevelNotify ? "text-emerald-400" : "text-slate-500"}`}>
                    {autoLevelNotify ? "Activo" : "Off"}
                  </span>
                  <button
                    onClick={() => setAutoLevelNotify(!autoLevelNotify)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoLevelNotify ? "bg-emerald-500" : "bg-slate-700"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoLevelNotify ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>

              {/* 2. Editor Amigable de Límites (v1.088) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                 <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">💰 Ajustar Límites de Economía</h3>
                    <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-black uppercase">Fácil Edición</span>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getDynamicLevels(values.LEVEL_LIMITS).map((lvl) => (
                      <div key={lvl.level} className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50 space-y-4 hover:border-slate-600 transition group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-black text-white text-sm">
                             <span className="text-lg grayscale group-hover:grayscale-0 transition-all">{lvl.icon}</span>
                             <span className="tracking-tighter">{lvl.name.toUpperCase()}</span>
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono">NIVEL {lvl.level}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                           <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest pl-1">Apuesta Máx (pts)</label>
                              <input 
                                type="number" 
                                placeholder={String(lvl.benefits.maxBetPoints)}
                                value={(() => {
                                  try {
                                    const ov = JSON.parse(values.LEVEL_LIMITS || "{}");
                                    return ov[lvl.level]?.maxBet ?? "";
                                  } catch { return ""; }
                                })()}
                                onChange={(e) => {
                                  let ov = {};
                                  try { ov = JSON.parse(values.LEVEL_LIMITS || "{}"); } catch {}
                                  const val = parseInt(e.target.value, 10);
                                  (ov as Record<number, Record<string, unknown>>)[lvl.level] = {
                                    ...(ov as Record<number, Record<string, unknown>>)[lvl.level],
                                    maxBet: Number.isNaN(val) ? undefined : val,
                                  };
                                  setValues(v => ({ ...v, LEVEL_LIMITS: JSON.stringify(ov, null, 2) }));
                                }}
                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-amber-500 focus:outline-none transition-colors shadow-inner" 
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest pl-1">Retiro Máx (BOLIS)</label>
                              <input 
                                type="number" 
                                placeholder={String(lvl.benefits.maxWithdrawBolis)}
                                value={(() => {
                                  try {
                                    const ov = JSON.parse(values.LEVEL_LIMITS || "{}");
                                    return ov[lvl.level]?.maxWithdraw ?? "";
                                  } catch { return ""; }
                                })()}
                                onChange={(e) => {
                                  let ov = {};
                                  try { ov = JSON.parse(values.LEVEL_LIMITS || "{}"); } catch {}
                                  const val = parseInt(e.target.value, 10);
                                  (ov as Record<number, Record<string, unknown>>)[lvl.level] = {
                                    ...(ov as Record<number, Record<string, unknown>>)[lvl.level],
                                    maxWithdraw: Number.isNaN(val) ? undefined : val,
                                  };
                                  setValues(v => ({ ...v, LEVEL_LIMITS: JSON.stringify(ov, null, 2) }));
                                }}
                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-amber-400 font-mono text-xs focus:border-amber-500 focus:outline-none transition-colors shadow-inner" 
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest pl-1">Premio al subir (pts)</label>
                              <input
                                type="number"
                                min={0}
                                placeholder={String(lvl.rewardPoints)}
                                value={(() => {
                                  try {
                                    const ov = JSON.parse(values.LEVEL_LIMITS || "{}");
                                    return ov[lvl.level]?.rewardPoints ?? "";
                                  } catch {
                                    return "";
                                  }
                                })()}
                                onChange={(e) => {
                                  let ov: Record<string, Record<string, unknown>> = {};
                                  try {
                                    ov = JSON.parse(values.LEVEL_LIMITS || "{}") as Record<string, Record<string, unknown>>;
                                  } catch {
                                    ov = {};
                                  }
                                  const val = parseInt(e.target.value, 10);
                                  ov[lvl.level] = {
                                    ...ov[lvl.level],
                                    rewardPoints: Number.isNaN(val) ? undefined : val,
                                  };
                                  setValues((v) => ({ ...v, LEVEL_LIMITS: JSON.stringify(ov, null, 2) }));
                                }}
                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-emerald-400 font-mono text-xs focus:border-emerald-500 focus:outline-none transition-colors shadow-inner"
                              />
                           </div>
                        </div>
                      </div>
                    ))}
                 </div>

                <button 
                  onClick={handleSave} 
                  disabled={saving} 
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition shadow-xl shadow-emerald-600/20 disabled:opacity-50 mt-2"
                >
                  {saving ? "🔄 Guardando..." : "💾 Actualizar Todos los Límites"}
                </button>
              </div>

              {/* 3. Vista Previa de Requisitos */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden opacity-80 hover:opacity-100 transition shadow-lg">
                <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/20">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Requisitos para Nivel Siguiente (Informativo)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-slate-800/10 text-slate-500 text-left uppercase">
                        <th className="px-4 py-3">Rango</th>
                        <th className="px-4 py-3 text-center">Apuestas</th>
                        <th className="px-4 py-3 text-center">Faucet</th>
                        <th className="px-4 py-3 text-center">Días</th>
                        <th className="px-4 py-3 text-center">Beneficios Actuales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {getDynamicLevels(values.LEVEL_LIMITS).map((l) => (
                        <tr key={l.level} className="hover:bg-slate-800/10 transition">
                          <td className="px-4 py-2 font-bold">{l.icon} {l.name}</td>
                          <td className="px-4 py-2 text-center text-slate-400 font-mono">{l.minBets.toLocaleString()}</td>
                          <td className="px-4 py-2 text-center text-slate-400 font-mono">{l.minFaucet.toLocaleString()}</td>
                          <td className="px-4 py-2 text-center text-slate-400 font-mono">{l.minDaysSinceJoined > 0 ? `${l.minDaysSinceJoined}d` : "-"}</td>
                          <td className="px-4 py-2 text-center">
                            <span className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 block sm:inline">
                              {l.benefits.maxBetPoints.toLocaleString()} pts / {l.benefits.maxWithdrawBolis} B
                            </span>
                            {l.rewardPoints > 0 && (
                              <span className="text-emerald-400 text-[10px] font-bold block mt-1">
                                +{l.rewardPoints.toLocaleString()} pts al subir
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Envío Manual Individual */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">📤 Envío Manual de Tarjeta</h3>
                <div className="flex gap-2">
                  <input id="level-user-id" type="text" placeholder="User ID (6 dígitos o UUID)"
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-white font-mono text-sm focus:border-amber-500 focus:outline-none" />
                  <button
                    onClick={async () => {
                      const uid = (document.getElementById('level-user-id') as HTMLInputElement)?.value?.trim();
                      if (!uid) { setLevelMsg("⚠️ Introduce un User ID."); return; }
                      setLevelMsg("Enviando...");
                      const r = await fetch('/api/admin/levels/notify-user', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: uid }) });
                      const d = await r.json();
                      setLevelMsg(d.ok ? `✅ Enviado a ${d.email}` : `❌ ${d.error}`);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition"
                  >Enviar</button>
                </div>
                {levelMsg && <p className="text-xs font-medium text-slate-400 italic">Estado: {levelMsg}</p>}
              </div>

              {/* 5. Envío Masivo */}
              <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-5 space-y-3 shadow-lg">
                <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest">📣 Envío Masivo</h3>
                <p className="text-[11px] text-slate-500">Enviar email masivo a todos con su tarjeta de nivel actual.</p>
                <button
                  disabled={levelSending}
                  onClick={async () => {
                    if (!confirm("¿Enviar email a TODOS?")) return;
                    setLevelSending(true);
                    setLevelMsg("⏳ Procesando...");
                    const r = await fetch('/api/admin/levels/sync-and-notify', { method: 'POST' });
                    const d = await r.json();
                    setLevelSending(false);
                    setLevelMsg(d.ok ? "✅ Completado" : `❌ ${d.error}`);
                  }}
                  className="w-full py-3 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-500 font-bold rounded-xl text-xs transition disabled:opacity-50"
                >
                  {levelSending ? "⏳ Enviando..." : "🚀 Iniciar Envío Masivo"}
                </button>
              </div>
            </section>
          ) : activeTab === "Promociones" ? (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-400">Gestiona campañas de palabras secretas.</p>
                <button
                  onClick={() => { setEditingPromo({ is_active: true, link_fuente: "https://x.com/BolivarCoin_XT" }); setShowPromoForm(true); }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition text-xs"
                >
                  + Nueva Campaña
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* List Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Campaña</th>
                        <th className="px-6 py-4">Palabra</th>
                        <th className="px-6 py-4">Progreso</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {promotions.map((p) => (
                        <tr 
                          key={p.id} 
                          className={`hover:bg-slate-800/30 transition cursor-pointer ${selectedPromo?.id === p.id ? 'bg-amber-500/5' : ''}`}
                          onClick={() => { setSelectedPromo(p); fetchPromoClaims(p.id); }}
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-white">{p.nombre}</div>
                            <div className="text-[9px] text-slate-500 font-mono italic">ID: {p.id.slice(0,8)}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-slate-800 border border-slate-700 text-amber-400 px-2 py-0.5 rounded font-mono font-black">{p.palabra}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[9px] text-slate-400 mb-1 flex justify-between font-black uppercase">
                              <span>{p.puntos_restantes.toLocaleString()}</span>
                              <span className="text-slate-600">/ {p.puntos_totales.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-amber-600 to-amber-400" 
                                style={{ width: `${(p.puntos_restantes / p.puntos_totales) * 100}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <button 
                                onClick={async () => {
                                  const r = await fetch('/api/promociones/intent-deposit', {
                                    method: 'POST',
                                    headers: {'Content-Type':'application/json'},
                                    body: JSON.stringify({ promoId: p.id })
                                  });
                                  if ((await r.json()).ok) {
                                    window.location.href = "/cuenta/depositar";
                                  }
                                }}
                                title="Cargar Puntos (BOLIS)"
                                className="p-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-slate-950 rounded-lg transition"
                              >
                                💰
                              </button>
                              <button 
                                onClick={() => togglePromoStatus(p)}
                                className={`p-1.5 rounded-lg transition ${p.is_active ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 bg-slate-800'}`}
                              >
                                {p.is_active ? "✅" : "🔘"}
                              </button>
                              <button 
                                onClick={() => { setEditingPromo(p); setShowPromoForm(true); }}
                                className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg"
                              >
                                ✏️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Claims History */}
                {selectedPromo && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-sm font-black text-white uppercase flex items-center gap-2 mb-4">
                      🕒 Historial: {selectedPromo.nombre}
                    </h3>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {claims.map((c) => (
                        <div key={c.id} className="bg-slate-800/20 border border-slate-800/50 p-2 rounded-xl flex items-center justify-between text-[11px]">
                          <div>
                            <p className="font-bold text-white">{c.profiles.email}</p>
                            <p className="text-[9px] text-slate-500">{new Date(c.claimed_at).toLocaleString()}</p>
                          </div>
                          <span className="text-emerald-400 font-black">+{c.points_awarded.toLocaleString()}</span>
                        </div>
                      ))}
                      {claims.length === 0 && <p className="text-center py-4 text-slate-500 text-xs italic">Sin reclamos aún.</p>}
                    </div>
                  </div>
                )}
              </div>

               {/* Modal Form */}
              {showPromoForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                    <h2 className="text-base font-black text-white uppercase mb-4">
                      {editingPromo?.id ? '✏️ Editar Promoción' : '✨ Nueva Campaña'}
                    </h2>
                    <form onSubmit={handleSavePromo} className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-1">Nombre (Español)</label>
                        <input 
                          type="text" 
                          value={editingPromo?.nombre || ""} 
                          onChange={(e) => setEditingPromo({...editingPromo, nombre: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-amber-500"
                          placeholder="Nombre en Español"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-1">Nombre (Inglés)</label>
                        <input 
                          type="text" 
                          value={editingPromo?.nombre_en || ""} 
                          onChange={(e) => setEditingPromo({...editingPromo, nombre_en: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-amber-500"
                          placeholder="Name in English"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="text" 
                          value={editingPromo?.palabra || ""} 
                          onChange={(e) => setEditingPromo({...editingPromo, palabra: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-amber-400 font-mono uppercase"
                          placeholder="PALABRA"
                          required
                        />
                        <input 
                          type="number" 
                          value={editingPromo?.puntos_por_usuario || ""} 
                          onChange={(e) => setEditingPromo({...editingPromo, puntos_por_usuario: parseInt(e.target.value)})}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white"
                          placeholder="Pts x User"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="number" 
                          value={editingPromo?.puntos_totales || ""} 
                          onChange={(e) => setEditingPromo({...editingPromo, puntos_totales: parseInt(e.target.value)})}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white"
                          placeholder="Pozo Total"
                          required
                        />
                        <input 
                          type="number" 
                          value={editingPromo?.puntos_restantes ?? editingPromo?.puntos_totales ?? ""} 
                          onChange={(e) => setEditingPromo({...editingPromo, puntos_restantes: parseInt(e.target.value)})}
                          className="w-full bg-slate-800 border border-amber-500/30 rounded-xl px-4 py-2 text-xs text-amber-500 font-bold"
                          placeholder="Quedan (Sync)"
                        />
                      </div>
                      <input 
                        type="url" 
                        value={editingPromo?.link_fuente || ""} 
                        onChange={(e) => setEditingPromo({...editingPromo, link_fuente: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white"
                        placeholder="Link Fuente (X)"
                      />
                      <div className="flex gap-2 pt-4">
                        <button type="button" onClick={() => setShowPromoForm(false)} className="flex-1 bg-slate-800 text-slate-400 font-bold py-2 rounded-xl text-xs">Cancelar</button>
                        <button type="submit" disabled={savingPromo} className="flex-1 bg-amber-500 text-slate-950 font-black py-2 rounded-xl text-xs uppercase">
                          {savingPromo ? "..." : "Guardar"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </section>
          ) : activeTab === "Influencers" ? (
             <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <InfluencerManager />
             </section>
          ) : activeTab === "Pausar Juegos" ? (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-bold text-white">Gestión de Mercados</h3>
                  <p className="text-sm text-slate-400 font-medium">Pulsa el botón para pausar o arrancar cada juego individualmente.</p>
                </div>
                <div className="hidden sm:block">
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Control Total
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "BTC_HOURLY", label: "BTC Hourly", icon: "📈", cat: "BTC" },
                  { id: "BTC_MINI", label: "BTC Mini", icon: "🔥", cat: "BTC" },
                  { id: "BTC_MICRO", label: "BTC Micro", icon: "⚡", cat: "BTC" },
                  { id: "SOL_HOURLY", label: "SOL Hourly", icon: "📈", cat: "SOL" },
                  { id: "SOL_MINI", label: "SOL Mini", icon: "🔥", cat: "SOL" },
                  { id: "SOL_MICRO", label: "SOL Micro", icon: "⚡", cat: "SOL" },
                  { id: "BOLIS_HOURLY", label: "BOLIS Hourly", icon: "📈", cat: "BOLIS" },
                  { id: "BOLIS_MINI", label: "BOLIS Mini", icon: "🔥", cat: "BOLIS" },
                  { id: "BOLIS_MICRO", label: "BOLIS Micro", icon: "⚡", cat: "BOLIS" },
                  { id: "HI_LO", label: "HI-LO Dice", icon: "🎲", cat: "Juego Original" },
                ].map((game) => {
                  const key = `PAUSE_GAME_${game.id}`;
                  const isPaused = values[key] === "1";
                  return (
                    <div key={game.id} className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 p-5 ${isPaused ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-xl'}`}>
                       <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                             <div className={`p-2.5 rounded-xl transition-colors ${isPaused ? 'bg-red-500/20 text-red-500' : 'bg-slate-800 text-amber-500 group-hover:bg-amber-500 group-hover:text-slate-900'}`}>
                                <span className="text-xl">{game.icon}</span>
                             </div>
                             <div>
                                <h4 className="font-black text-white text-sm tracking-tight">{game.label}</h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{game.cat}</p>
                             </div>
                          </div>
                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${isPaused ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                             <div className={`h-1.5 w-1.5 rounded-full ${isPaused ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                             {isPaused ? 'Pausado' : 'Activo'}
                          </div>
                       </div>
                       
                       <button
                         onClick={() => {
                           const newVal = isPaused ? "0" : "1";
                           setValues(v => ({ ...v, [key]: newVal }));
                         }}
                         className={`w-full py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-lg ${
                           isPaused 
                           ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' 
                           : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                         }`}
                       >
                         {isPaused ? '▶️ Reanudar Juego' : '⏸️ Pausar Juego'}
                       </button>

                       {isPaused && (
                         <p className="mt-3 text-[10px] text-red-400/80 font-medium italic text-center">
                            "Mercado bloqueado temporalmente por administración"
                         </p>
                       )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 p-6 rounded-3xl bg-slate-100 text-slate-900 shadow-2xl">
                 <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-amber-500 rounded-2xl shadow-lg">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                       </svg>
                    </div>
                    <div>
                       <h4 className="font-black uppercase tracking-tight">Confirmar Cambios</h4>
                       <p className="text-xs font-bold text-slate-500 leading-tight">Debes guardar para aplicar los bloqueos al servidor.</p>
                    </div>
                 </div>
                 <button 
                  onClick={handleSave} 
                  disabled={saving} 
                  className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black rounded-2xl transition disabled:opacity-50"
                 >
                    {saving ? "🔄 Aplicando cambios..." : "🚀 Sincronizar con el Servidor"}
                 </button>
              </div>
            </section>
          ) : activeTab === "Staff" ? (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white uppercase mb-4 tracking-widest">Delegados del Sistema</h3>
                <p className="text-xs text-slate-500 mb-6">Autoriza a usuarios específicos para que entren únicamente a ciertas secciones del Admin.</p>
                
                {/* Listado */}
                <div className="space-y-3 mb-6">
                   {staff.map((s: any) => (
                     <div key={s.id} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700 rounded-xl">
                        <div>
                          <p className="text-sm font-bold text-white">{s.profiles?.email || "Usuario ID: " + s.user_id.slice(0,8)}</p>
                          <p className="text-[10px] text-emerald-400 font-mono">Permisos: {Object.keys(s.permissions || {}).join(", ")}</p>
                          {s.authorized_device && <p className="text-[9px] text-slate-500">📱 Dispositivo vinculado</p>}
                        </div>
                        <button 
                          onClick={async () => {
                            if (!confirm("¿Eliminar acceso?")) return;
                            await fetch(`/api/admin/staff?id=${s.id}`, { method: 'DELETE' });
                            window.location.reload();
                          }}
                          className="p-2 text-rose-400 hover:bg-rose-400/10 rounded-lg transition"
                        >🗑️</button>
                     </div>
                   ))}
                   {staff.length === 0 && <p className="text-center py-4 text-slate-500 text-xs italic">No hay delegados registrados.</p>}
                </div>

                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 mb-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3">Agregar Nuevo Delegado</h4>
                  <div className="flex gap-2">
                    <input id="staff-user-id" type="text" placeholder="User ID o Email" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500" />
                    <button 
                      onClick={async () => {
                        const uid = (document.getElementById('staff-user-id') as HTMLInputElement)?.value;
                        if (!uid) return;
                        const res = await fetch('/api/admin/staff', { method: 'POST', body: JSON.stringify({ userId: uid, permissions: { promotions: true } }) });
                        if (res.ok) window.location.reload();
                        else {
                          const errData = await res.json().catch(() => ({}));
                          alert("Error: " + (errData.error || "No se pudo agregar al staff."));
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm transition"
                    >Autorizar Promos</button>
                  </div>
                </div>

                <div className="text-slate-400 text-xs italic">
                  * Nota: Por ahora solo se soporta la delegación de &quot;Promociones&quot;. Los delegados deben haber entrado al menos una vez a la web.
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                  {FIELDS.filter((f) => {
                    const group = activeTab === "Predicciones" ? "Predicciones (General)" : activeTab;
                    return f.group === group;
                  }).map((field) => (
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
    </div>
  );
}
