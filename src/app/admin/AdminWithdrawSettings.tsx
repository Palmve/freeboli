"use client";

import { useState, useEffect } from "react";

export default function AdminWithdrawSettings() {
    const [autoWithdraw, setAutoWithdraw] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
        try {
            const res = await fetch("/api/admin/bot/status");
            const d = await res.json();
            setAutoWithdraw(!!d.settings?.WITHDRAWAL_AUTO_APPROVE);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleToggle() {
        setSaving(true);
        setMsg("");
        const newVal = !autoWithdraw;
        setAutoWithdraw(newVal);
        try {
            const res = await fetch("/api/admin/bot/settings", {
                method: "POST",
                body: JSON.stringify({ WITHDRAWAL_AUTO_APPROVE: newVal })
            });
            if (res.ok) {
                setMsg("Configuración guardada.");
            } else {
                setMsg("Error al guardar.");
                setAutoWithdraw(!newVal);
            }
        } catch (e) {
            setMsg("Error de conexión.");
            setAutoWithdraw(!newVal);
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-4 animate-pulse bg-slate-800 rounded-xl h-24"></div>;

    return (
        <div className="card border-amber-500/20 bg-amber-500/5">
            <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Configuración de Retiros
            </h2>
            <p className="text-xs text-slate-400 mt-1">Controla si los pagos se envían automáticamente a la blockchain.</p>

            <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl mt-4">
                <div className="space-y-0.5">
                    <span className="text-sm font-bold text-slate-200 uppercase">Retiros Automáticos (BOLIS)</span>
                    <p className="text-[10px] text-slate-500 font-medium">Procesar pagos sin autorización manual</p>
                </div>
                <button 
                    onClick={handleToggle} 
                    disabled={saving}
                    className={`w-12 h-6 rounded-full transition-colors ${autoWithdraw ? "bg-amber-500" : "bg-slate-700"} relative disabled:opacity-50`}
                >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoWithdraw ? "left-7" : "left-1"}`}></div>
                </button>
            </div>
            
            {msg && <p className="mt-2 text-[10px] text-amber-500 italic font-bold text-center">{msg}</p>}

            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                <p className="text-[10px] text-slate-500 leading-tight">
                    <span className="text-amber-500 font-black">IMPORTANTE:</span> Con esta opción activa, los retiros se procesarán en cuanto el usuario los solicite, siempre que la Master Wallet tenga saldo suficiente.
                </p>
            </div>
        </div>
    );
}
