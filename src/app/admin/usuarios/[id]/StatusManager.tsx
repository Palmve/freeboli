"use client";

import { useState } from "react";
import { UserStatus } from "../page";

const STATUS_CONFIG: Record<UserStatus, { label: string; bg: string; text: string; description: string }> = {
  normal: { 
    label: "Normal", 
    bg: "bg-green-500/20", 
    text: "text-green-400",
    description: "Usuario activo. Puede jugar, reclamar faucet y retirar libremente."
  },
  evaluar: { 
    label: "A Evaluar", 
    bg: "bg-yellow-500/20", 
    text: "text-yellow-400",
    description: "Bajo observación. Patrones sospechosos detectados."
  },
  suspendido: { 
    label: "Suspendido", 
    bg: "bg-orange-500/20", 
    text: "text-orange-400",
    description: "Bloqueo temporal. Sin retiros ni juegos."
  },
  bloqueado: { 
    label: "Bloqueado", 
    bg: "bg-red-500/20", 
    text: "text-red-400",
    description: "Bloqueo permanente. Acceso denegado."
  },
};

const STATUS_OPTIONS: UserStatus[] = ["normal", "evaluar", "suspendido", "bloqueado"];

export default function StatusManager({ userId, currentStatus }: { userId: string, currentStatus: UserStatus }) {
  const [status, setStatus] = useState<UserStatus>(currentStatus);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: UserStatus) {
    if (newStatus === status) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/user-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Gestión de Cuenta</h3>
      <div className="space-y-3">
        {STATUS_OPTIONS.map((s) => {
          const cfg = STATUS_CONFIG[s];
          const isCurrent = status === s;
          return (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              disabled={loading}
              className={`w-full flex flex-col items-start p-3 rounded-xl border-2 transition-all ${
                isCurrent 
                  ? "border-amber-500 bg-amber-500/10" 
                  : "border-transparent bg-slate-800/40 hover:bg-slate-800 opacity-60 hover:opacity-100"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</span>
                {isCurrent && <span className="text-[10px] text-amber-500 font-black">ACTIVO</span>}
              </div>
              <p className="text-[10px] text-slate-500 mt-1 leading-tight text-left">{cfg.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
