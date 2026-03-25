"use client";

import { useState, useEffect } from "react";
import TravelMap from "@/components/TravelMap";

const ACCESS_CODE = "a8107474";

export default function PrivateTravelPage() {
  const [code, setCode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveActivity() {
    if (!editingActivity) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/travel/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: ACCESS_CODE, activity: editingActivity })
      });
      if (!res.ok) throw new Error("Fallo al guardar");
      setEditingActivity(null);
      fetchActivities();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    const savedAttempts = localStorage.getItem("travel_login_attempts");
    const blockedTimestamp = localStorage.getItem("travel_login_blocked");
    
    if (blockedTimestamp && Date.now() - Number(blockedTimestamp) < 15 * 60 * 1000) {
      setIsBlocked(true);
    } else if (savedAttempts) {
      setAttempts(Number(savedAttempts));
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (isBlocked) return;

    if (code === ACCESS_CODE) {
      setIsAuthorized(true);
      fetchActivities();
      localStorage.removeItem("travel_login_attempts");
      localStorage.removeItem("travel_login_blocked");
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem("travel_login_attempts", String(newAttempts));

      if (newAttempts >= 10) {
        setIsBlocked(true);
        localStorage.setItem("travel_login_blocked", String(Date.now()));
        setError("Demasiados intentos. Bloqueado por 15 minutos.");
      } else {
        setError(`Código incorrecto. (${newAttempts}/10 intentos)`);
      }
      setTimeout(() => setError(""), 3000);
    }
  }

  async function fetchActivities() {
    setLoading(true);
    try {
      const res = await fetch(`/api/travel/activities?code=${ACCESS_CODE}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActivities(data);
      // Dynamically inject CSS for map styling
      const style = document.createElement('style');
      style.innerHTML = `
        .leaflet-container { background: #020617 !important; }
        .leaflet-tile-container { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
      `;
      document.head.appendChild(style);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full glass-card p-10 rounded-[2.5rem] shadow-2xl animate-fade-in outline outline-1 outline-white/5">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">✈️</div>
            <h1 className="text-2xl font-black text-white tracking-tight">Acceso Privado</h1>
            <p className="text-slate-400 text-sm mt-2">Introduce el código para ver el itinerario de Alemania.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={code}
              disabled={isBlocked}
              onChange={(e) => setCode(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-center text-white text-xl tracking-[0.5em] outline-none focus:border-amber-500 transition-all font-mono disabled:opacity-50"
              placeholder="••••••••"
              autoFocus
            />
            {error && <p className="text-red-400 text-center text-xs font-bold animate-pulse">{error}</p>}
            <button
              type="submit"
              disabled={isBlocked}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-2xl shadow-xl shadow-amber-500/20 transition-all active:scale-95 uppercase tracking-widest text-sm disabled:bg-slate-800 disabled:text-slate-500"
            >
              {isBlocked ? "BLOQUEADO" : "Entrar"}
            </button>
          </form>
          <p className="text-[10px] text-slate-600 text-center mt-8 uppercase tracking-tighter">Solo personal autorizado - Intentos: {attempts}/10</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-12 gap-8 h-full">
        
        {/* Sidebar: Cronograma */}
        <div className="lg:col-span-5 flex flex-col h-[calc(100vh-4rem)]">
          <header className="mb-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
               <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-3 py-1 rounded-full border border-amber-500/20 uppercase tracking-widest">Viaje Familiar</span>
               <span className="text-slate-500 text-[10px] font-bold uppercase">• Marzo - Abril 2026</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">Alemania <br/><span className="text-amber-500 italic">Itinerario.</span></h1>
            <div className="flex items-center gap-4 mt-6 p-4 glass-card rounded-2xl border-white/5">
                <div className="text-2xl">🏡</div>
                <div>
                   <p className="text-[10px] font-bold text-slate-500 uppercase">Base Principal</p>
                   <p className="text-xs font-bold text-slate-300">Wunstorf (Sahlenkamp 3)</p>
                </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
            {activities.map((act, i) => (
              <div 
                key={act.id} 
                onClick={() => setEditingActivity({...act})}
                className="group p-6 glass-card rounded-3xl hover:border-amber-500/50 transition-all cursor-pointer animate-fade-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-amber-500 text-xs font-black uppercase tracking-tighterbg-amber-500/10 px-2 py-1 rounded-lg">
                    DÍA 0{act.day_number} — {act.date_str}
                  </span>
                  <div className="text-xl grayscale group-hover:grayscale-0 transition-all">{
                    act.icon === 'flight' ? '✈️' : 
                    act.icon === 'party' ? '🎂' : 
                    act.icon === 'hotel' ? '🏡' : '🏛️'
                  }</div>
                </div>
                <h3 className="text-lg font-black text-white mb-1 group-hover:text-amber-500 transition-colors">{act.title}</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-1">📍 {act.location}</p>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">{act.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main: Mapa & Visuals */}
        <div className="lg:col-span-7 h-[calc(100vh-4rem)] flex flex-col gap-6 min-h-[500px]">
          <div className="flex-1 relative min-h-[400px]">
            <TravelMap activities={activities} />
          </div>
          <div className="grid grid-cols-3 gap-4 h-40">
             <div className="glass-card rounded-[2rem] p-6 flex flex-col justify-end overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-amber-500/20 to-transparent"></div>
                <p className="text-[10px] font-black text-amber-500 uppercase mb-1">Total</p>
                <p className="text-3xl font-black text-white">8 <span className="text-xs text-slate-500">DÍAS</span></p>
             </div>
             <div className="glass-card rounded-[2rem] p-6 flex flex-col justify-end">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Ciudades</p>
                <p className="text-xl font-black text-white">Hannover<br/>Leipzig<br/>Berlín</p>
             </div>
             <div 
                onClick={() => activities.length > 0 && setEditingActivity({...activities[0]})}
                className={`glass-card rounded-[2rem] p-6 flex flex-col justify-center items-center text-center hover:bg-amber-500 transition-all group cursor-pointer ${activities.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
                <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">⚙️</div>
                <p className="text-[10px] font-black text-slate-500 group-hover:text-black uppercase">Editar<br/>Plan</p>
             </div>
          </div>
        </div>

      </div>

      {/* Modal de Edición */}
      {editingActivity && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-xl w-full glass-card p-8 rounded-[2.5rem] shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
               <h2 className="text-xl font-black text-white uppercase tracking-tight">Editar Día {editingActivity.day_number}</h2>
               <button onClick={() => setEditingActivity(null)} className="text-slate-500 hover:text-white transition">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Título</label>
                 <input 
                   value={editingActivity.title} 
                   onChange={e => setEditingActivity({...editingActivity, title: e.target.value})}
                   className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-500"
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Fecha</label>
                 <input 
                   value={editingActivity.date_str} 
                   onChange={e => setEditingActivity({...editingActivity, date_str: e.target.value})}
                   className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-500"
                 />
               </div>
               <div className="col-span-2 space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Ubicación</label>
                 <input 
                   value={editingActivity.location} 
                   onChange={e => setEditingActivity({...editingActivity, location: e.target.value})}
                   className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-500"
                 />
               </div>
               <div className="col-span-2 space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Descripción</label>
                 <textarea 
                   value={editingActivity.description} 
                   onChange={e => setEditingActivity({...editingActivity, description: e.target.value})}
                   className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-500 h-24 resize-none"
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Latitud</label>
                 <input 
                   type="number" step="any"
                   value={editingActivity.lat} 
                   onChange={e => setEditingActivity({...editingActivity, lat: Number(e.target.value)})}
                   className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-500"
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Longitud</label>
                 <input 
                   type="number" step="any"
                   value={editingActivity.lng} 
                   onChange={e => setEditingActivity({...editingActivity, lng: Number(e.target.value)})}
                   className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-500"
                 />
               </div>
            </div>

            <div className="flex gap-4 pt-4">
               <button 
                 onClick={() => setEditingActivity(null)}
                 className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-2xl transition"
               >
                 Cancelar
               </button>
               <button 
                 onClick={handleSaveActivity}
                 disabled={isSaving}
                 className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-2xl shadow-xl shadow-amber-500/20 transition-all disabled:opacity-50"
               >
                 {isSaving ? "Guardando..." : "Guardar Cambios"}
               </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
