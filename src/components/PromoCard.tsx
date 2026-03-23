import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useLang } from "@/context/LangContext";

export interface PromoData {
  id: string;
  nombre: string;
  nombre_en?: string;
  puntos_totales: number;
  puntos_restantes: number;
  puntos_por_usuario: number;
  link_fuente: string;
}

interface PromoCardProps {
  initialPromo?: PromoData | null;
}

export default function PromoCard({ initialPromo }: PromoCardProps) {
  const { data: session } = useSession();
  const { t, lang } = useLang();
  const [promo, setPromo] = useState<PromoData | null>(initialPromo || null);
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isMounting, setIsMounting] = useState(!initialPromo);

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
    if (!initialPromo) {
      fetchActivePromo();
    }
  }, [initialPromo]);

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
    <div className={`card p-4 space-y-4 shadow-lg shadow-amber-500/20 border border-slate-700 bg-slate-900/40 relative overflow-hidden group`}>
      {/* Cabecera: Nivel actual (Copiado de LevelProgressCard) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 transition-all duration-500 group-hover:scale-[1.02]">
          <span className="text-4xl drop-shadow-lg scale-100 group-hover:scale-110 transition-transform duration-500">🎁</span>
          <div>
            <div className="text-lg font-extrabold tracking-wide text-amber-500 leading-tight">
              {lang === "es" ? promo.nombre : (promo.nombre_en || promo.nombre)}
            </div>
            <div className="text-xs text-slate-400">
              {lang === "es" ? "Busca la palabra en" : "Find the word on"}{" "}
              <a 
                href={promo.link_fuente} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline font-bold"
              >
                Twitter ↗
              </a>
            </div>
          </div>
        </div>
        <div className="text-right">
           <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30">
            +{promo.puntos_por_usuario.toLocaleString()} PTS
          </span>
        </div>
      </div>

      {/* Barra de progreso global (Copiada de LevelProgressCard) */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>{lang === "es" ? "Cupos disponibles" : "Remaining pool"}</span>
          <span className="font-mono font-bold text-white">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 transition-all duration-1000 ease-out relative shadow-[0_0_15px_rgba(245,158,11,0.3)]"
            style={{ width: `${progressPercent}%` }}
          >
            {progressPercent > 10 && (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] text-slate-950 font-bold">
                {Math.round(progressPercent)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Beneficios actuales (Estilo cajas LevelProgressCard) */}
      <form onSubmit={handleClaim} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-2 text-center group/input focus-within:border-amber-500/50 transition-colors">
            <div className="text-slate-400 mb-0.5 uppercase tracking-tighter text-[10px]">{lang === "es" ? "Ingresa Código" : "Enter Code"}</div>
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="••••••"
              className="w-full bg-transparent text-center font-bold text-white placeholder-slate-700 outline-none text-sm uppercase tracking-widest"
              disabled={loading || !session}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !word.trim() || !session}
            className="rounded-lg bg-slate-800/60 border border-slate-700 p-2 text-center hover:bg-slate-700 transition group/btn disabled:opacity-50"
          >
            <div className="text-slate-400 mb-0.5 uppercase tracking-tighter text-[10px]">{lang === "es" ? "Acción" : "Action"}</div>
            <div className="font-bold text-amber-500 group-hover/btn:scale-105 transition-transform flex items-center justify-center gap-1">
              {loading ? "..." : (lang === "es" ? "CANJEAR" : "CLAIM")}
            </div>
          </button>
        </div>

        {/* Footer Link (Para simetría con "Ver requisitos") */}
        <div className="pt-1 text-center">
          {status ? (
            <p className={`text-[10px] font-bold uppercase tracking-widest animate-in fade-in ${
              status.type === "success" ? "text-emerald-400" : "text-rose-400"
            }`}>
              {status.message}
            </p>
          ) : (
            <button
              type="button" 
              className="text-[10px] text-slate-500 hover:text-slate-300 transition flex items-center justify-center gap-1 mx-auto"
              onClick={() => window.open(promo.link_fuente, '_blank')}
            >
              ▼ {lang === "es" ? "Ver base de la promoción" : "View promotion info"}
            </button>
          )}
        </div>

        {!session && (
          <p className="text-center text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
            {lang === "es" ? "Inicia sesión para participar" : "Login to participate"}
          </p>
        )}
      </form>
    </div>
  );
}
