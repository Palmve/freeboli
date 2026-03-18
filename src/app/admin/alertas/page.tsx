"use client";

import { useState } from "react";

const ALERT_TYPES = [
  { icon: "👤", label: "Nuevo usuario registrado", trigger: "Al registrarse un usuario nuevo" },
  { icon: "💸", label: "Solicitud de retiro", trigger: "Cuando un usuario solicita retirar BOLIS" },
  { icon: "💰", label: "Deposito detectado", trigger: "Cuando se detecta un deposito entrante" },
  { icon: "🎰", label: "Gran ganancia HI-LO", trigger: "Cuando un usuario gana >= 50% del limite por jugada" },
  { icon: "🛑", label: "Limite diario alcanzado", trigger: "Cuando un usuario llega al 80% del limite diario" },
  { icon: "🔍", label: "Actividad sospechosa", trigger: "Deteccion automatica de patrones sospechosos" },
  { icon: "🚫", label: "Usuario suspendido/bloqueado", trigger: "Cuando un admin cambia el status de un usuario" },
  { icon: "🕵️", label: "Multiples cuentas misma IP", trigger: "Cuando se detectan 4+ cuentas desde la misma IP" },
  { icon: "❌", label: "Error del sistema", trigger: "Cuando ocurre un error critico en un endpoint" },
  { icon: "📊", label: "Resumen diario", trigger: "Automatico a la 1:00 AM UTC (cron)" },
];

export default function AlertasPage() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [summaryTesting, setSummaryTesting] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);

  async function testBot() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/telegram-test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTestResult({ ok: true, message: "Mensaje enviado. Revisa tu Telegram." });
      } else {
        setTestResult({ ok: false, message: data.error || "Error al enviar" });
      }
    } catch {
      setTestResult({ ok: false, message: "Error de conexion" });
    } finally {
      setTesting(false);
    }
  }

  async function triggerSummary() {
    setSummaryTesting(true);
    setSummaryResult(null);
    try {
      const res = await fetch("/api/cron/daily-summary");
      const data = await res.json().catch(() => ({}));
      setSummaryResult(data.ok ? "Resumen enviado a Telegram." : data.error || "Error");
    } catch {
      setSummaryResult("Error de conexion");
    } finally {
      setSummaryTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Alertas y Monitoreo (Telegram)</h2>

      {/* Connection test */}
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold text-amber-400">Conexion del Bot</h3>
        <p className="text-sm text-slate-400">
          Configuracion requerida en variables de entorno de Vercel:
        </p>
        <div className="rounded bg-slate-900 p-3 font-mono text-xs text-slate-300 space-y-1">
          <p>TELEGRAM_BOT_TOKEN=tu_token_de_botfather</p>
          <p>TELEGRAM_CHAT_ID=tu_chat_id</p>
        </div>
        <p className="text-xs text-slate-500">
          1. Abre Telegram y busca @BotFather, crea un bot con /newbot
          {" "}2. Copia el token
          {" "}3. Envia un mensaje al bot, luego visita https://api.telegram.org/bot[TOKEN]/getUpdates para obtener tu chat_id
        </p>

        <div className="flex gap-3">
          <button onClick={testBot} disabled={testing} className="btn-primary text-sm disabled:opacity-50">
            {testing ? "Enviando..." : "Enviar mensaje de prueba"}
          </button>
          <button onClick={triggerSummary} disabled={summaryTesting} className="btn-secondary text-sm disabled:opacity-50">
            {summaryTesting ? "Enviando..." : "Enviar resumen ahora"}
          </button>
        </div>

        {testResult && (
          <div className={`rounded p-2 text-sm ${testResult.ok ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
            {testResult.message}
          </div>
        )}
        {summaryResult && (
          <div className={`rounded p-2 text-sm ${summaryResult.includes("Error") ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
            {summaryResult}
          </div>
        )}
      </div>

      {/* Alert types */}
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold text-amber-400">Tipos de alertas configuradas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="p-2"></th>
                <th className="p-2">Alerta</th>
                <th className="p-2">Cuando se dispara</th>
              </tr>
            </thead>
            <tbody>
              {ALERT_TYPES.map((a) => (
                <tr key={a.label} className="border-b border-slate-700/50">
                  <td className="p-2 text-center text-lg">{a.icon}</td>
                  <td className="p-2 text-white font-medium">{a.label}</td>
                  <td className="p-2 text-slate-400">{a.trigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cron schedules */}
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold text-amber-400">Cron Jobs activos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="p-2">Tarea</th>
                <th className="p-2">Horario</th>
                <th className="p-2">Descripcion</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-700/50">
                <td className="p-2 text-white">Procesar depositos</td>
                <td className="p-2 font-mono text-amber-400">Cada 12h</td>
                <td className="p-2 text-slate-400">Busca depositos BOLIS entrantes</td>
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="p-2 text-white">Premios ranking</td>
                <td className="p-2 font-mono text-amber-400">00:05 UTC</td>
                <td className="p-2 text-slate-400">Otorga premios diarios/semanales/mensuales</td>
              </tr>
              <tr className="border-b border-slate-700/50">
                <td className="p-2 text-white">Resumen diario</td>
                <td className="p-2 font-mono text-amber-400">01:00 UTC</td>
                <td className="p-2 text-slate-400">Envia resumen a Telegram</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
