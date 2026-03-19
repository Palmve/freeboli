"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SupportModal } from "@/components/SupportModal";

type PredictionData = {
  id: string;
  asset: string;
  opening_price: number;
  current_price: number;
  odds: { up: number; down: number };
  time_left_sec: number;
  start_time: string;
  end_time: string;
};

type BetHistory = {
  id: string;
  round_id: string;
  amount: number;
  prediction: "up" | "down";
  odds_at_bet: number;
  potential_payout: number;
  claimed: boolean;
  created_at: string;
  round?: {
      status: string;
      opening_price: number;
      closing_price: number;
      asset: string;
  }
};

type Stats = {
  day: number;
  week: number;
  month: number;
  total: number;
};

export default function PredictionsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const asset = searchParams.get("asset")?.toUpperCase() || "BTC";

  const [data, setData] = useState<PredictionData | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<BetHistory[]>([]);
  const [stats, setStats] = useState<Stats>({ day: 0, week: 0, month: 0, total: 0 });
  
  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [betting, setBetting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/predictions/active?asset=${asset}`);
      const d = await res.json();
      if (res.ok) setData(d);
      else setError(d.error);
    } catch (e) {
      setError("Error al conectar con la API.");
    }
  }, [asset]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/predictions/history");
      const d = await res.json();
      if (res.ok) {
          setHistory(d.history);
          setStats(d.stats);
      }
    } catch (e) {}
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/faucet");
      const d = await res.json();
      setBalance(d.points ?? 0);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchData();
    fetchHistory();
    fetchBalance();
    const timer = setInterval(() => {
        fetchData();
        fetchHistory();
    }, 10000); 
    return () => clearInterval(timer);
  }, [fetchData, fetchHistory, fetchBalance]);

  const handleBet = async (prediction: "up" | "down") => {
    setError("");
    setSuccess("");
    setBetting(true);
    try {
      const res = await fetch("/api/predictions/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, prediction, amount: parseInt(amount) }),
      });
      const resData = await res.json();
      if (res.ok) {
        setSuccess(`¡Apuesta de ${amount} pts a ${prediction.toUpperCase()} realizada!`);
        setBalance(resData.newBalance);
        fetchHistory();
        window.dispatchEvent(new CustomEvent("freeboli-balance-update", { detail: resData.newBalance }));
      } else {
        setError(resData.error);
      }
    } catch (e) {
      setError("Error de red.");
    } finally {
      setBetting(false);
    }
  };

  const isUp = data ? data.current_price >= data.opening_price : false;
  const diff = data ? ((data.current_price - data.opening_price) / data.opening_price) * 100 : 0;
  
  const minutes = data ? Math.floor(data.time_left_sec / 60) : 0;
  const seconds = data ? data.time_left_sec % 60 : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header & Tabs */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Predicción de Precio</h1>
          <p className="text-slate-400">Pronostica el movimiento de {asset} cada hora.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["BTC", "SOL", "BOLIS"].map((a) => (
            <Link 
              key={a}
              href={`/predicciones?asset=${a}`} 
              className={`rounded-lg px-6 py-2.5 text-sm font-bold transition ${asset === a ? "bg-amber-500 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              {a}
            </Link>
          ))}
        </div>
      </div>

      {error && <div className="mb-6 rounded-lg bg-red-500/20 p-4 text-center text-red-400 border border-red-500/50 font-medium">{error}</div>}
      {success && <div className="mb-6 rounded-lg bg-emerald-500/20 p-4 text-center text-emerald-400 border border-emerald-500/50 font-medium">{success}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Panel Izquierdo: Precio y Tiempo */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
            <div className="flex justify-between items-start mb-6">
                <div>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Precio Actual {asset}</p>
                   <div className="mt-1 flex items-baseline gap-3">
                     <span className="text-5xl font-mono font-bold text-white tracking-tighter">
                       ${data?.current_price.toLocaleString(undefined, { minimumFractionDigits: asset === "BOLIS" ? 4 : 2 })}
                     </span>
                     <span className={`text-xl font-bold flex items-center ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                       {isUp ? "▲" : "▼"} {Math.abs(diff).toFixed(3)}%
                     </span>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cierre de Ronda</p>
                   <p className="text-3xl font-mono font-bold text-amber-400 mt-1">
                     {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                   </p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                    <span>Apertura de hora</span>
                    <span>Progreso de ronda</span>
                    <span>Cierre</span>
                </div>
                <div className="h-4 w-full bg-slate-800 rounded-full p-1 border border-slate-700">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${data && data.time_left_sec < 600 ? "bg-red-500" : "bg-amber-500"}`} 
                      style={{ width: `${(3600 - (data?.time_left_sec || 0)) / 3600 * 100}%` }}
                    />
                </div>
                <div className="flex justify-between text-sm text-slate-400 font-mono">
                    <span>${data?.opening_price.toLocaleString()}</span>
                    <span>{data ? new Date(data.end_time).toLocaleTimeString() : "--:--"}</span>
                </div>
            </div>
          </div>

          {/* Historial de Apuestas */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden shadow-xl">
            <div className="border-b border-slate-700 bg-slate-800/50 px-6 py-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    Historial de Apuestas
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-800/30 text-slate-500 text-left">
                            <th className="px-6 py-3 font-bold uppercase tracking-wider">Activo</th>
                            <th className="px-6 py-3 font-bold uppercase tracking-wider">Predicción</th>
                            <th className="px-6 py-3 font-bold uppercase tracking-wider">Monto</th>
                            <th className="px-6 py-3 font-bold uppercase tracking-wider">Cuota</th>
                            <th className="px-6 py-3 font-bold uppercase tracking-wider text-right">G/P</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {history.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-slate-500">No has realizado apuestas aún.</td>
                            </tr>
                        ) : (
                            history.map(bet => {
                                const isResolved = bet.round?.status === "resolved";
                                const win = isResolved && ((bet.round?.closing_price || 0) >= (bet.round?.opening_price || 0) ? "up" : "down") === bet.prediction;
                                return (
                                    <tr key={bet.id} className="hover:bg-slate-800/30 transition">
                                        <td className="px-6 py-4 font-bold text-slate-300">{bet.round?.asset || asset}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${bet.prediction === "up" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                                {bet.prediction === "up" ? "Sube ▲" : "Baja ▼"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-slate-300">{bet.amount.toLocaleString()}</td>
                                        <td className="px-6 py-4 font-mono text-slate-400">{bet.odds_at_bet}x</td>
                                        <td className={`px-6 py-4 text-right font-mono font-bold ${!isResolved ? "text-slate-500" : win ? "text-emerald-400" : "text-red-400"}`}>
                                            {!isResolved ? "Pendiente" : (win ? `+${(bet.potential_payout - bet.amount).toLocaleString()}` : `-${bet.amount.toLocaleString()}`)}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
          </div>
        </div>

        {/* Panel Derecho: Apuesta y Stats */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-500/30 bg-slate-900 p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
            </div>
            
            <div className="mb-6">
                <p className="text-sm font-bold text-slate-400 uppercase">Balance Disponible</p>
                <p className="text-3xl font-mono font-bold text-amber-400">{balance?.toLocaleString() || "0"} pts</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">Monto de Apuesta</label>
              <div className="relative">
                  <input
                    type="number"
                    max={10000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-4 pr-12 py-4 text-xl font-mono text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">PTS</span>
              </div>
              <div className="mt-2 flex gap-2">
                 {[100, 500, 2500, 10000].map(v => (
                     <button key={v} onClick={() => setAmount(String(v))} className="flex-1 text-xs py-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 transition">
                         {v >= 1000 ? `${v/1000}K` : v}
                     </button>
                 ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-500 text-center font-bold uppercase tracking-tighter">
                LÍMITE MÁXIMO: 10,000 PUNTOS -- Comisión de 5% (incluida en la cuota)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleBet("up")}
                disabled={betting || !data || data.time_left_sec < 600}
                className="group relative flex flex-col items-center justify-center overflow-hidden rounded-xl bg-emerald-600 py-6 text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                <span className="text-xs font-black uppercase tracking-widest mb-1 opacity-70">Sube</span>
                <span className="text-3xl font-black">{data?.odds.up}x</span>
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-emerald-400/50"></div>
              </button>

              <button
                onClick={() => handleBet("down")}
                disabled={betting || !data || data.time_left_sec < 600}
                className="group relative flex flex-col items-center justify-center overflow-hidden rounded-xl bg-red-600 py-6 text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                <span className="text-xs font-black uppercase tracking-widest mb-1 opacity-70">Baja</span>
                <span className="text-3xl font-black">{data?.odds.down}x</span>
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-red-400/50"></div>
              </button>
            </div>
            
            {data && data.time_left_sec < 600 && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                  <p className="text-center text-[11px] text-red-500 font-bold uppercase leading-tight">
                    Mercado Cerrado: 10 min antes del fin de hora para evitar manipulación.
                  </p>
              </div>
            )}
          </div>

          {/* Resumen de Ganancias */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
             <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Resumen de Ganancias
             </h3>
             <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50">
                    <span className="text-sm text-slate-400 font-bold">HOY</span>
                    <span className={`font-mono font-bold ${stats.day >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {stats.day >= 0 ? "+" : ""}{stats.day.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50">
                    <span className="text-sm text-slate-400 font-bold">ESTA SEMANA</span>
                    <span className={`font-mono font-bold ${stats.week >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {stats.week >= 0 ? "+" : ""}{stats.week.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50">
                    <span className="text-sm text-slate-400 font-bold">ESTE MES</span>
                    <span className={`font-mono font-bold ${stats.month >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {stats.month >= 0 ? "+" : ""}{stats.month.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <span className="text-sm text-amber-500 font-black uppercase">TOTAL ACUMULADO</span>
                    <span className={`text-xl font-mono font-black ${stats.total >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {stats.total >= 0 ? "+" : ""}{stats.total.toLocaleString()}
                    </span>
                </div>
             </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setSupportOpen(true)}
        className="text-[10px] text-slate-600 hover:text-slate-500 transition mt-8 block mx-auto tracking-normal"
      >
        ¿Problemas con la predicción? Reportar error o disputa aquí
      </button>

      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        defaultType="dispute"
        userEmail={session?.user?.email ?? ""}
      />
    </div>
  );
}
