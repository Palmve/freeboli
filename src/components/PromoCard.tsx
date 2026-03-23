import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useLang } from "@/context/LangContext";

interface PromoData {
  id: string;
  nombre: string;
  puntos_totales: number;
  puntos_restantes: number;
  puntos_por_usuario: number;
  link_fuente: string;
}

export default function PromoCard() {
  const { data: session } = useSession();
  const { t, lang } = useLang();
  const [promo, setPromo] = useState<PromoData | null>(null);
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isMounting, setIsMounting] = useState(true);

  const fetchActivePromo = async () => {
    try {
      const res = await fetch("/api/promociones/activa");
      const data = await res.json();
      if (data.promo) {
        setPromo(data.promo);
      } else {
        setPromo(null);
      }
    } catch (err) {
      console.error("Error fetching promo:", err);
    } finally {
      setIsMounting(false);
    }
  };

  useEffect(() => {
    fetchActivePromo();
  }, []);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || loading) return;

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/promociones/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", message: data.message });
        setWord("");
        fetchActivePromo(); // Refresh progress
        // Refresh balance after claim
        window.dispatchEvent(new Event("freeboli-balance-update"));
      } else {
        setStatus({ type: "error", message: data.error });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Error al conectar con el servidor" });
    } finally {
      setLoading(false);
    }
  };

  if (isMounting) return null;
  if (!promo) return null;

  const progressPercent = Math.max(0, Math.min(100, (promo.puntos_restantes / promo.puntos_totales) * 100));

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🎁</span>
        <h2 className="text-base font-black text-slate-300 uppercase tracking-widest">{lang === "es" ? "Promoción Activa" : "Active Promotion"}</h2>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-900/50 p-6 backdrop-blur-xl transition-all hover:border-amber-500/50 shadow-lg shadow-amber-900/10">
      {/* Background Glow */}
      <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 text-2xl">
              🎁
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight leading-tight">
                {promo.nombre}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === "es" ? "Busca la palabra secreta en" : "Find the secret word on"}{" "}
                <a 
                  href={promo.link_fuente} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline inline-flex items-center gap-1"
                >
                  Twitter 
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              +{promo.puntos_por_usuario.toLocaleString()} PTS
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
             <span>{lang === "es" ? "Cupos restantes" : "Remaining Pool"}</span>
             <span className="text-amber-400">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/50 ring-1 ring-white/5">
            <div 
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleClaim} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={lang === "es" ? "Escribe la palabra aquí..." : "Type secret word here..."}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
              disabled={loading || !session}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !word.trim() || !session}
            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-3 text-sm font-bold text-slate-900 shadow-lg transition-all hover:scale-[1.02] hover:shadow-amber-500/25 active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
          >
            <div className="flex items-center justify-center gap-2">
              {loading ? (
                <svg className="h-4 w-4 animate-spin text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <span className="uppercase tracking-widest">{lang === "es" ? "Canjear Puntos" : "Claim Points"}</span>
              )}
            </div>
          </button>
        </form>

        {/* Status Message */}
        {status && (
          <div className={`mt-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium animate-in fade-in slide-in-from-top-1 ${
            status.type === "success" 
              ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20" 
              : "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20"
          }`}>
            <span>{status.type === "success" ? "✅" : "⚠️"}</span>
            {status.message}
          </div>
        )}

        {!session && (
          <p className="mt-2 text-center text-[10px] text-slate-500">
            {lang === "es" ? "Debes iniciar sesión para canjear" : "You must log in to claim"}
          </p>
        )}
      </div>
    </div>
  </section>
  );
}
