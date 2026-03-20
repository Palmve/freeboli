"use client";

import { useState, useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

export default function BotAdminPage() {
  const [settings, setSettings] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    fetchBotData();
  }, []);

  const fetchBotData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bot/status");
      const d = await res.json();
      setSettings(d.settings);
      setWallets(d.wallets);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setStatusMsg("Guardando...");
    try {
        const res = await fetch("/api/admin/bot/settings", {
            method: "POST",
            body: JSON.stringify(settings)
        });
        if (res.ok) {
            setStatusMsg("Configuración guardada.");
            fetchBotData();
        }
    } catch (e) {
        setStatusMsg("Error al guardar.");
    }
  };

  const handleToggle = async () => {
      const newVal = !settings.BOT_ENABLED;
      setSettings({ ...settings, BOT_ENABLED: newVal });
      // Guardar inmediatamente el toggle
      await fetch("/api/admin/bot/settings", {
          method: "POST",
          body: JSON.stringify({ BOT_ENABLED: newVal })
      });
  };

  const generateWallet = async () => {
    setStatusMsg("Generando wallet...");
    try {
        const res = await fetch("/api/admin/bot/generate-wallet", { method: "POST" });
        if (res.ok) {
            setStatusMsg("Wallet generada con éxito.");
            fetchBotData();
        }
    } catch (e) {
        setStatusMsg("Error al generar wallet.");
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Cargando Bot Engine...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-2xl sm:text-3xl font-bold text-white">Bot de Volumen (Raydium)</h1>
           <p className="text-slate-400">Versión {APP_VERSION}</p>
        </div>
        <div className={`px-4 py-2 rounded-full font-bold text-sm ${settings?.BOT_ENABLED ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
            {settings?.BOT_ENABLED ? "● ACTIVO" : "○ DESACTIVADO"}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuración */}
        <div className="card space-y-4">
           <h2 className="text-xl font-bold text-slate-200">Configuración General</h2>
           <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl">
                 <span className="text-sm font-bold text-slate-300">Estado del Bot</span>
                 <button onClick={handleToggle} className={`w-12 h-6 rounded-full transition-colors ${settings?.BOT_ENABLED ? "bg-emerald-500" : "bg-slate-700"} relative`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.BOT_ENABLED ? "left-7" : "left-1"}`}></div>
                 </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Int. Mínimo (min)</label>
                    <input 
                        type="number" 
                        value={settings?.BOT_MIN_INTERVAL} 
                        onChange={(e) => setSettings({...settings, BOT_MIN_INTERVAL: parseInt(e.target.value)})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mt-1 text-white font-mono" 
                    />
                 </div>
                 <div>
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Int. Máximo (min)</label>
                    <input 
                        type="number" 
                        value={settings?.BOT_MAX_INTERVAL} 
                        onChange={(e) => setSettings({...settings, BOT_MAX_INTERVAL: parseInt(e.target.value)})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mt-1 text-white font-mono" 
                    />
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Monto Mín (BOLIS)</label>
                    <input 
                        type="number" 
                        value={settings?.BOT_MIN_AMOUNT} 
                        onChange={(e) => setSettings({...settings, BOT_MIN_AMOUNT: parseInt(e.target.value)})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mt-1 text-white font-mono" 
                    />
                 </div>
                 <div>
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Monto Máx (BOLIS)</label>
                    <input 
                        type="number" 
                        value={settings?.BOT_MAX_AMOUNT} 
                        onChange={(e) => setSettings({...settings, BOT_MAX_AMOUNT: parseInt(e.target.value)})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mt-1 text-white font-mono" 
                    />
                 </div>
              </div>
           </div>
           <button onClick={handleSave} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3 rounded-xl mt-4 transition shadow-lg shadow-amber-500/20 uppercase tracking-widest text-sm">
             GUARDAR CONFIGURACIÓN
           </button>
        </div>

        {/* Flota de Wallets */}
        <div className="card space-y-4">
           <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-200">Enjambre de Wallets</h2>
              <button onClick={generateWallet} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-white font-bold uppercase tracking-widest border border-slate-600">
                + GENERAR NUEVA
              </button>
           </div>
           {statusMsg && <p className="text-xs text-amber-500 italic animate-pulse">{statusMsg}</p>}
           <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {wallets.map(w => (
                <div key={w.id} className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl flex justify-between items-center group hover:border-amber-500/30 transition">
                   <div className="space-y-1">
                      <p className="font-mono text-slate-300 text-sm group-hover:text-amber-400 transition">
                        {w.public_key.slice(0,6)}...{w.public_key.slice(-6)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">{w.description || "Bot Worker"}</p>
                   </div>
                   <div className="text-right">
                      <p className="font-mono font-bold text-emerald-400">--- SOL</p>
                      <p className="text-[9px] text-slate-500 uppercase font-bold">Visto: {w.last_used ? new Date(w.last_used).toLocaleTimeString() : 'Inactiva'}</p>
                   </div>
                </div>
              ))}
              {wallets.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                    <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Sin wallets registradas</p>
                </div>
              )}
           </div>
        </div>
      </div>
      
      <p className="text-center text-[10px] text-slate-600 uppercase tracking-widest">
        El bot ejecutará operaciones en segundo plano utilizando el saldo disponible en las wallets activas. Asegúrate de fondear la Master Wallet.
      </p>
    </div>
  );
}
