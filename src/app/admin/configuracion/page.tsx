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

  const groups = [...new Set(FIELDS.map((f) => f.group))];

  if (loading) return <p className="text-slate-400">Cargando configuración...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Configuración del sistema</h2>
      <p className="text-sm text-slate-400">
        Modifica los parámetros del sistema. Los cambios se aplican inmediatamente.
      </p>

      {message && (
        <div className={`rounded p-2 text-sm ${message.includes("Error") ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
          {message}
        </div>
      )}

      {groups.map((group) => (
        <div key={group} className="card space-y-3">
          <h3 className="text-lg font-semibold text-amber-400">{group}</h3>
          {FIELDS.filter((f) => f.group === group).map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-300">{field.label}</label>
              <p className="text-xs text-slate-500 mb-1">{field.description}</p>
              {field.defaultValue !== undefined && (
                <p className="text-xs text-amber-500/80 mb-1">Valor por defecto: {field.defaultValue}</p>
              )}
              {field.type === "json" ? (
                <textarea
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  rows={4}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-xs text-white"
                />
              ) : (
                <input
                  type="number"
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                />
              )}
            </div>
          ))}
        </div>
      ))}

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full disabled:opacity-50">
        {saving ? "Guardando..." : "Guardar configuración"}
      </button>

      {/* Reward templates editor */}
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold text-amber-400">Valores de logros</h3>
        <p className="text-xs text-slate-500">Modifica los puntos que otorga cada logro.</p>

        {templateMsg && (
          <div className={`rounded p-2 text-sm ${templateMsg.includes("Error") ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
            {templateMsg}
          </div>
        )}

        {templates.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm text-slate-300">{t.name}</p>
              <p className="text-xs text-slate-500">{t.code}</p>
            </div>
            <input
              type="number"
              value={templateEdits[t.id] ?? ""}
              onChange={(e) => setTemplateEdits((v) => ({ ...v, [t.id]: e.target.value }))}
              className="w-28 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-right text-sm text-white"
            />
          </div>
        ))}

        <button onClick={saveTemplates} className="btn-secondary w-full">
          Guardar valores de logros
        </button>
      </div>
    </div>
  );
}
