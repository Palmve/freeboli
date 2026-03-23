"use client";

import { useState } from "react";

interface Props {
  initialWithdrawnEnabled: boolean;
  initialAutoApproveEnabled: boolean;
}

export default function AdminEmergencyPanel({ initialWithdrawnEnabled, initialAutoApproveEnabled }: Props) {
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(initialWithdrawnEnabled);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(initialAutoApproveEnabled);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const updateSetting = async (key: string, value: any) => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { [key]: value }
        })
      });
      const data = await res.json();
      if (data.ok) {
        if (key === "WITHDRAWALS_ENABLED") setWithdrawalsEnabled(value === 1);
        if (key === "WITHDRAWAL_AUTO_APPROVE_ENABLED") setAutoApproveEnabled(value === 1);
        setMessage("Configuración actualizada con éxito.");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Error al actualizar.");
      }
    } catch {
      setMessage("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-6 shadow-2xl shadow-red-500/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-500/20 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Panel de Emergencia</h2>
          <p className="text-xs text-slate-400 font-medium">Controles críticos de seguridad global</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Control Retiros */}
        <div className={`p-4 rounded-xl border transition-all ${withdrawalsEnabled ? "bg-slate-800/50 border-slate-700" : "bg-red-500/10 border-red-500/30"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-300">Retiros Globales</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${withdrawalsEnabled ? "bg-emerald-500 text-white" : "bg-red-600 text-white animate-pulse"}`}>
              {withdrawalsEnabled ? "Habilitados" : "DETENIDOS"}
            </span>
          </div>
          <button
            disabled={loading}
            onClick={() => {
              if (confirm(`¿Seguro que deseas ${withdrawalsEnabled ? "DETENER" : "HABILITAR"} los retiros globalmente?`)) {
                updateSetting("WITHDRAWALS_ENABLED", withdrawalsEnabled ? 0 : 1);
              }
            }}
            className={`w-full py-2.5 rounded-lg font-bold text-sm transition shadow-lg ${
              withdrawalsEnabled 
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
            }`}
          >
            {withdrawalsEnabled ? "⛔ DETENER RETIROS" : "✅ REANUDAR RETIROS"}
          </button>
        </div>

        {/* Control Auto-Pagos */}
        <div className={`p-4 rounded-xl border transition-all ${autoApproveEnabled ? "bg-slate-800/50 border-slate-700" : "bg-amber-500/10 border-amber-500/30"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-300">Pagos Automáticos</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${autoApproveEnabled ? "bg-emerald-500 text-white" : "bg-amber-600 text-white"}`}>
              {autoApproveEnabled ? "Activos (-100k)" : "MÁNUAL"}
            </span>
          </div>
          <button
            disabled={loading}
            onClick={() => {
              if (confirm(`¿Seguro que deseas ${autoApproveEnabled ? "PAUSAR" : "ACTIVAR"} los pagos automáticos?`)) {
                updateSetting("WITHDRAWAL_AUTO_APPROVE_ENABLED", autoApproveEnabled ? 0 : 1);
              }
            }}
            className={`w-full py-2.5 rounded-lg font-bold text-sm transition shadow-lg ${
              autoApproveEnabled 
                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
            }`}
          >
            {autoApproveEnabled ? "⏸️ PAUSAR AUTO-PAGOS" : "⚡ ACTIVAR AUTO-PAGOS"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded-lg text-xs font-bold text-center ${message.includes("Error") ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
          {message}
        </div>
      )}
    </div>
  );
}
