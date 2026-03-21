"use client";

import { useState, useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

export default function BotAdminPage() {
  const [settings, setSettings] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
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
      setRecentTrades(d.recent_trades || []);
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
          <div className={`px-4 py-2 rounded-full font-bold text-xs shadow-lg flex items-center gap-2 ${settings?.BOT_ENABLED ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {settings?.BOT_ENABLED ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                SISTEMA OPERANDO
              </>
            ) : "○ BOT DETENIDO"}
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
            {Number(wallets.reduce((s, w) => s + (w.sol_balance || 0), 0)).toFixed(2)} <span className="text-[10px] opacity-60 font-sans text-slate-400">SOL</span>
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
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                <label className="text-[10px] text-amber-500 uppercase font-black tracking-widest flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Int. Mínimo (min)
                </label>
                <input
                  type="number"
                  value={settings?.BOT_MIN_INTERVAL || 0}
                  onChange={(e) => setSettings({ ...settings, BOT_MIN_INTERVAL: parseInt(e.target.value) })}
                  className="w-full bg-transparent border-none focus:ring-0 p-0 mt-2 text-white font-mono text-2xl font-black"
                />
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                <label className="text-[10px] text-amber-500 uppercase font-black tracking-widest flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Int. Máximo (min)
                </label>
                <input
                  type="number"
                  value={settings?.BOT_MAX_INTERVAL || 0}
                  onChange={(e) => setSettings({ ...settings, BOT_MAX_INTERVAL: parseInt(e.target.value) })}
                  className="w-full bg-transparent border-none focus:ring-0 p-0 mt-2 text-white font-mono text-2xl font-black"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center">
              El bot operará en un intervalo aleatorio entre estos dos valores.
            </p>
          </div>
          <button onClick={handleSave} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3 rounded-xl mt-4 transition shadow-lg shadow-amber-500/20 uppercase tracking-widest text-sm">
            GUARDAR CONFIGURACIÓN
          </button>
        </div>

        {/* Últimas Operaciones */}
        <div className="card space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-200">Últimas Operaciones</h2>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Mostrando las 10 más recientes
            </div>
          </div>
          {statusMsg && <p className="text-xs text-amber-500 italic animate-pulse">{statusMsg}</p>}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {recentTrades.map(t => (
              <div key={t.id} className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl flex flex-col gap-2 hover:border-amber-500/30 transition">
                <div className="flex justify-between items-center">
                  <div className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded ${t.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {t.side === 'BUY' ? 'COMPRA' : 'VENTA'} BOLIS
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="font-mono text-white text-sm">
                      {t.side === 'BUY' ? `+${t.amount_out.toFixed(2)} BOLIS` : `-${t.amount_in.toFixed(2)} BOLIS`}
                    </p>
                    <a href={`https://solscan.io/tx/${t.tx_signature}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-amber-500 hover:text-amber-400 font-mono truncate max-w-[150px] inline-block">
                      Solscan ↗
                    </a>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-mono">
                      @ {Number(t.price).toFixed(6)} SOL
                    </p>
                    {t.pnl !== 0 && (
                      <p className={`text-[10px] font-bold font-mono ${t.pnl > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        PnL: {t.pnl > 0 ? '+' : ''}{t.pnl.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {recentTrades.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Aún no hay operaciones registradas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-600 uppercase tracking-widest">
        El bot ejecutará operaciones en segundo plano utilizando el saldo disponible en la Master Wallet.
      </p>
    </div>
  );
}
