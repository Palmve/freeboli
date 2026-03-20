"use client";

import { useState, useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

export default function BotAdminPage() {
  const [settings, setSettings] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");

  const [stats, setStats] = useState<any>(null);

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
      setStats(d.stats);
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

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
             <span className="text-amber-500">Grid</span> Bot Analítico
           </h1>
           <p className="text-slate-400 text-sm">Estrategia de Rejilla v{APP_VERSION}</p>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={fetchBotData} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition" title="Refrescar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
            <div className={`px-4 py-2 rounded-full font-bold text-xs shadow-lg ${settings?.BOT_ENABLED ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                {settings?.BOT_ENABLED ? "● SISTEMA ACTIVO" : "○ BOT EN ESPERA"}
            </div>
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-kpi bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/50 p-4 rounded-2xl shadow-xl">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">PnL Acumulado</p>
              <p className={`text-xl font-mono font-bold ${stats?.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {stats?.total_pnl >= 0 ? "+" : ""}{Number(stats?.total_pnl || 0).toFixed(4)} <span className="text-[10px] opacity-60 font-sans">BOLIS</span>
              </p>
              <div className="mt-2 text-[9px] text-slate-500">Basado en {stats?.total_trades || 0} trades</div>
          </div>
          <div className="card-kpi bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/50 p-4 rounded-2xl shadow-xl">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Operaciones</p>
              <p className="text-xl font-mono font-bold text-white">
                {stats?.total_trades || 0}
              </p>
              <div className="mt-2 text-[9px] text-slate-500">Últimos 30 días</div>
          </div>
          <div className="card-kpi bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/50 p-4 rounded-2xl shadow-xl">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Comisiones (Gas)</p>
              <p className="text-xl font-mono font-bold text-amber-400/80">
                {Number(stats?.total_fees || 0).toFixed(5)} <span className="text-[10px] opacity-60 font-sans text-slate-400">SOL</span>
              </p>
              <div className="mt-2 text-[9px] text-slate-500">Inversión operativa</div>
          </div>
          <div className="card-kpi bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/50 p-4 rounded-2xl shadow-xl">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Saldo Global (Flota)</p>
              <p className="text-xl font-mono font-bold text-white">
                {Number(wallets.reduce((s,w) => s + (w.sol_balance || 0), 0)).toFixed(2)} <span className="text-[10px] opacity-60 font-sans text-slate-400">SOL</span>
              </p>
              <div className="mt-2 text-[9px] text-slate-500">Fondo en {wallets.length} wallets</div>
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
              
              <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="space-y-0.5">
                     <span className="text-sm font-bold text-amber-500 uppercase">Retiros Automáticos (SOL/BOLIS)</span>
                     <p className="text-[10px] text-slate-500 font-medium tracking-tight">Procesar pagos sin autorización manual</p>
                  </div>
                  <button 
                    onClick={() => setSettings({...settings, WITHDRAWAL_AUTO_APPROVE: !settings.WITHDRAWAL_AUTO_APPROVE})} 
                    className={`w-12 h-6 rounded-full transition-colors ${settings?.WITHDRAWAL_AUTO_APPROVE ? "bg-amber-500" : "bg-slate-700"} relative`}
                  >
                     <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.WITHDRAWAL_AUTO_APPROVE ? "left-7" : "left-1"}`}></div>
                  </button>
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
                      <p className="font-mono text-slate-300 text-sm group-hover:text-amber-400 transition text-wrap break-all">
                        {w.public_key}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">{w.description || "Bot Worker"}</p>
                   </div>
                   <div className="text-right whitespace-nowrap">
                      <p className="font-mono font-bold text-emerald-400">{(w.sol_balance || 0).toFixed(4)} SOL</p>
                      <p className="text-[9px] text-slate-500 uppercase font-bold">Historial: {w.last_used ? new Date(w.last_used).toLocaleTimeString() : 'Inactiva'}</p>
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
        El bot ejecutará operaciones en segundo plano utilizando el saldo disponible en las wallets activas. Asegúrate de que las wallets tengan saldo real en Solana Mainnet si deseas operaciones reales.
      </p>
    </div>
  );
}
