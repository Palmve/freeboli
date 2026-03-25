"use client";

import { useState, useEffect } from "react";

interface Influencer {
  user_id: string;
  bounty_per_confirmed_user: number;
  max_withdrawal_amount: number;
  max_daily_withdrawals: number;
  auto_approve_withdrawals: boolean;
  is_active: boolean;
  profiles: {
    email: string;
    name: string;
    public_id: number;
  };
  stats: {
    referrals: number;
    bounty_points: number;
    total_earned: number;
  };
}

export default function InfluencerManager() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [newEmail, setNewEmail] = useState("");
  const [newBounty, setNewBounty] = useState(1000); // 1 Boli default
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchInfluencers();
  }, []);

  async function fetchInfluencers() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/influencers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fallo al cargar influencers");
      setInfluencers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddInfluencer(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/influencers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, bounty: newBounty })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al agregar influencer");
      setNewEmail("");
      fetchInfluencers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendEmail(userId: string, lang: "es" | "en") {
    try {
      const res = await fetch("/api/admin/influencers/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ influencerId: userId, lang })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar email");
      alert(lang === "es" ? "¡Reporte enviado con éxito!" : "Report sent successfully!");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <span className="text-amber-500 text-2xl">🤝</span>
          GESTIÓN DE INFLUENCERS / CONVENIOS
        </h2>
        <button 
          onClick={fetchInfluencers}
          className="p-2 hover:bg-slate-800 rounded-full transition text-slate-400"
        >
          🔄
        </button>
      </div>

      {/* Formulario Agregar */}
      <form onSubmit={handleAddInfluencer} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Email del Influencer</label>
          <input 
            type="email" 
            value={newEmail} 
            onChange={e => setNewEmail(e.target.value)}
            placeholder="ejemplo@correo.com"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-500"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Puntos por Registro Verificado</label>
          <input 
            type="number" 
            value={newBounty} 
            onChange={e => setNewBounty(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-500"
            required
          />
        </div>
        <div className="flex items-end">
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 px-4 rounded-xl shadow-lg shadow-amber-500/10 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Agregando..." : "Registrar Convenio"}
          </button>
        </div>
      </form>

      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-xs p-3 rounded-xl">{error}</div>}

      {/* Lista de Influencers */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-slate-500 animate-pulse">Cargando convenios...</div>
        ) : influencers.length === 0 ? (
          <div className="text-center py-10 text-slate-600 italic">No hay influencers registrados aún.</div>
        ) : (
          <div className="grid gap-4">
            {influencers.map(inf => (
              <div key={inf.user_id} className="bg-slate-800/40 border border-slate-700/30 p-5 rounded-2xl group hover:border-amber-500/30 transition-all">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <p className="text-sm font-black text-white">{inf.profiles.name || 'Sin nombre'}</p>
                       <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">ID: {inf.profiles.public_id}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">{inf.profiles.email}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div className="space-y-1">
                       <p className="text-[10px] font-bold text-slate-500 uppercase">Referidos</p>
                       <p className="text-lg font-black text-white leading-none">{inf.stats.referrals}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-bold text-slate-500 uppercase">Bono Logrado</p>
                       <p className="text-lg font-black text-emerald-400 leading-none">{inf.stats.bounty_points.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-bold text-slate-500 uppercase">Monto Total</p>
                       <p className="text-lg font-black text-amber-400 leading-none">{(inf.stats.total_earned / 1000).toFixed(2)} <span className="text-[8px]">BOLIS</span></p>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => handleSendEmail(inf.user_id, "es")}
                      className="bg-slate-700 hover:bg-slate-600 text-xs font-bold py-2 px-3 rounded-lg transition"
                      title="Enviar reporte en Español"
                    >
                      🇪🇸 MAIL
                    </button>
                    <button 
                      onClick={() => handleSendEmail(inf.user_id, "en")}
                      className="bg-slate-700 hover:bg-slate-600 text-xs font-bold py-2 px-3 rounded-lg transition"
                      title="Send report in English"
                    >
                      🇺🇸 MAIL
                    </button>
                    <button className="bg-slate-900 border border-slate-700 p-2 rounded-lg hover:border-amber-500 transition" title="Ver tabla de detalles">
                      📋
                    </button>
                  </div>
                </div>
                
                {/* Status Bar */}
                <div className="mt-4 pt-4 border-t border-slate-700/30 flex items-center justify-between text-[10px]">
                   <div className="flex gap-4">
                      <span className="text-slate-500 font-bold">Límite: <span className="text-slate-300">{(inf.max_withdrawal_amount/1000)}B / {inf.max_daily_withdrawals} día</span></span>
                      <span className="text-slate-500 font-bold">Auto-Aprobación: <span className={inf.auto_approve_withdrawals ? "text-emerald-500" : "text-amber-500"}>{inf.auto_approve_withdrawals ? "ACTIVA" : "OFF"}</span></span>
                   </div>
                   <span className="text-slate-500 italic">Bono: {inf.bounty_per_confirmed_user} pts / conversion</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
