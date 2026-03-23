import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Promotion {
  id: string;
  nombre: string;
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

export default function AdminPromocionesPage() {
  const { data: session } = useSession();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPromotions = async () => {
    try {
      const res = await fetch("/api/admin/promociones");
      const data = await res.json();
      setPromotions(data.promotions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClaims = async (promoId: string) => {
    try {
      const res = await fetch(`/api/admin/promociones/claims?promoId=${promoId}`);
      const data = await res.json();
      setClaims(data.claims || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/promociones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPromo),
      });
      if (res.ok) {
        fetchPromotions();
        setShowForm(false);
        setEditingPromo(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (promo: Promotion) => {
    try {
      await fetch("/api/admin/promociones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...promo, is_active: !promo.is_active }),
      });
      fetchPromotions();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center">
    <svg className="h-8 w-8 animate-spin text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <span className="text-amber-500">📢</span> Gestión de Promociones
          </h1>
          <p className="text-sm text-slate-500">Configura palabras secretas y reparte puntos de fidelidad.</p>
        </div>
        <button
          onClick={() => { setEditingPromo({ is_active: true, link_fuente: "https://x.com/BolivarCoin_XT" }); setShowForm(true); }}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition shadow-lg shadow-amber-500/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Campaña
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl self-start">
          <table className="w-full text-left text-sm">
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
                  onClick={() => { setSelectedPromo(p); fetchClaims(p.id); }}
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-white">{p.nombre}</div>
                    <div className="text-[10px] text-slate-500 font-mono tracking-wider italic">ID: {p.id.slice(0,8)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 border border-slate-700 text-amber-400 px-2 py-1 rounded font-mono text-xs font-black tracking-widest">{p.palabra}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] text-slate-400 mb-1 flex justify-between font-black">
                      <span>{p.puntos_restantes.toLocaleString()}</span>
                      <span className="text-slate-600">/ {p.puntos_totales.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                        style={{ width: `${(p.puntos_restantes / p.puntos_totales) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                       <button 
                        onClick={() => toggleStatus(p)}
                        className={`p-2 rounded-lg transition ${p.is_active ? 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-slate-500 bg-slate-800 hover:bg-slate-700'}`}
                      >
                        {p.is_active ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                      <button 
                        onClick={() => { setEditingPromo(p); setShowForm(true); }}
                        className="p-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2.236 2.236 0 113.182 3.182L12 14.382l-4 1 1-4 9.586-9.586z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Claims Table / Detail */}
        <div className="space-y-6">
          {selectedPromo ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <span className="text-blue-400">🕒</span> Historial: {selectedPromo.nombre}
                </h3>
                <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest">
                  {claims.length} USUARIOS
                </span>
              </div>
              
              <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                {claims.length > 0 ? (
                  claims.map((c) => (
                    <div key={c.id} className="bg-slate-800/20 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-500 group-hover:text-blue-400 transition">
                          👤
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-none">{c.profiles.email}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase font-black">{new Date(c.claimed_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-400 font-black text-lg">+{c.points_awarded.toLocaleString()}</span>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">Puntos</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                    <p className="text-slate-500 italic text-sm">No hay reclamos registrados para esta campaña.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="text-slate-700 text-6xl mb-4 opacity-20">🕒</div>
              <p className="text-slate-500 max-w-xs mx-auto text-sm">Selecciona una promoción para ver el historial detallado de reclamos por usuario.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-2">
              {editingPromo?.id ? '✏️ Editar Promoción' : '✨ Nueva Campaña'}
            </h2>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre de Campaña</label>
                <input 
                  type="text" 
                  value={editingPromo?.nombre || ""} 
                  onChange={(e) => setEditingPromo({...editingPromo, nombre: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500 transition shadow-inner"
                  placeholder="Ej: Twitter Martes 23"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Palabra Secreta</label>
                  <input 
                    type="text" 
                    value={editingPromo?.palabra || ""} 
                    onChange={(e) => setEditingPromo({...editingPromo, palabra: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500 transition font-mono uppercase tracking-widest shadow-inner text-amber-400"
                    placeholder="SECRET2026"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Puntos x Usuario</label>
                  <input 
                    type="number" 
                    value={editingPromo?.puntos_por_usuario || ""} 
                    onChange={(e) => setEditingPromo({...editingPromo, puntos_por_usuario: parseInt(e.target.value)})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500 transition shadow-inner"
                    placeholder="500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Pozo Total (Puntos)</label>
                <input 
                  type="number" 
                  value={editingPromo?.puntos_totales || ""} 
                  onChange={(e) => setEditingPromo({...editingPromo, puntos_totales: parseInt(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500 transition shadow-inner"
                  placeholder="50000"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Link de Fuente (X/Twitter)</label>
                <input 
                  type="url" 
                  value={editingPromo?.link_fuente || ""} 
                  onChange={(e) => setEditingPromo({...editingPromo, link_fuente: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500 transition text-sm shadow-inner"
                  placeholder="https://x.com/..."
                />
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-3.5 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3.5 rounded-xl transition shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {saving ? (
                    <svg className="h-5 w-5 animate-spin text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : 'Guardar Campaña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
