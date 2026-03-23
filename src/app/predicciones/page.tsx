"use client";

import { useSession } from "next-auth/react";
import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SupportModal } from "@/components/SupportModal";
import { BetDetailModal } from "@/components/BetDetailModal";
import { APP_VERSION } from "@/lib/version";
import { useLang } from "@/context/LangContext";

type PredictionData = {
  id: string;
  asset: string;
  opening_price: number;
  current_price: number;
  odds: { up?: number; down?: number; micro?: number };
  time_left_sec: number;
  start_time: string;
  end_time: string;
  type?: "hourly" | "mini" | "micro";
};

type BetHistory = {
  id: string;
  short_id?: string;
  round_id: string;
  amount: number;
  prediction: string;
  odds_at_bet: number;
  potential_payout: number;
  claimed: boolean;
  created_at: string;
  type?: "hourly" | "mini" | "micro";
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

function PredictionsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { lang, t } = useLang();
  const asset = searchParams.get("asset")?.toUpperCase() || "BTC";

  const [data, setData] = useState<PredictionData | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<BetHistory[]>([]);
  const [stats, setStats] = useState<Stats>({ day: 0, week: 0, month: 0, total: 0 });
  const [type, setType] = useState<"hourly" | "mini" | "micro">("hourly");
  
  const [amount, setAmount] = useState("1");
  const [levelMaxBet, setLevelMaxBet] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [betting, setBetting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<BetHistory | null>(null);

  // Notificación que desaparece a los 10 segundos
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null });

  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: "", type: null });
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/predictions/active?asset=${asset}&type=${type}`);
      const d = await res.json();
      if (res.ok) setData(d);
      else showNotification(d.error, "error");
    } catch (e) {
      showNotification(t("predictions.error_api"), "error");
    }
  }, [asset, type, t]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/predictions/history?type=${type}`);
      const d = await res.json();
      if (res.ok) {
          setHistory(d.history);
          setStats(d.stats);
      }
    } catch (e) {}
  }, [type]);

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
    const syncTimer = setInterval(() => {
        fetchData();
        fetchHistory();
        fetchBalance(); // Actualizar balance periódicamente también
    }, 10000); 
    return () => clearInterval(syncTimer);
  }, [fetchData, fetchHistory, fetchBalance]);

  // Fetchear balance cuando la sesión esté disponible
  useEffect(() => {
    if (session?.user) {
        fetchBalance();
        fetch("/api/user/level-stats")
          .then(r => r.json())
          .then(d => {
              if (d.currentLevel) setLevelMaxBet(d.currentLevel.benefits?.maxBetPoints || 500);
          })
          .catch(() => {});
    }
  }, [session?.user, fetchBalance]);

  // Escuchar eventos globales de actualización de balance (para sincronizar con el Header)
  useEffect(() => {
    const onBalanceUpdate = (e: CustomEvent<number>) => {
      if (typeof e.detail === "number") setBalance(e.detail);
    };
    window.addEventListener("freeboli-balance-update", onBalanceUpdate as EventListener);
    return () => window.removeEventListener("freeboli-balance-update", onBalanceUpdate as EventListener);
  }, []);

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (data?.time_left_sec !== undefined) {
      setTimeLeft(data.time_left_sec);
    }
  }, [data]);

  const handleBet = async (prediction: string) => {
    setNotification({ message: "", type: null });
    setBetting(true);
    try {
      const res = await fetch("/api/predictions/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, type, prediction, amount: parseInt(amount) }),
      });
      const resData = await res.json();
      if (res.ok) {
        showNotification(t("predictions.success_bet").replace("{0}", amount).replace("{1}", prediction.toUpperCase()), "success");
        setBalance(resData.newBalance);
        fetchHistory();
        window.dispatchEvent(new CustomEvent("freeboli-balance-update", { detail: resData.newBalance }));
      } else {
        showNotification(resData.error, "error");
      }
    } catch (e) {
      showNotification(t("predictions.error_network"), "error");
    } finally {
      setBetting(false);
    }
  };

  const isUp = data ? data.current_price >= data.opening_price : false;
  const diff = data ? ((data.current_price - data.opening_price) / data.opening_price) * 100 : 0;
  
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const modeName = type === "mini" ? t("predictions.mode_mini") : type === "micro" ? "Micro (2m)" : t("predictions.mode_normal");

  const totalTimeSec = type === "mini" ? 600 : type === "micro" ? 120 : 3600;
  const cutoffLimit = type === "mini" ? 120 : type === "micro" ? 60 : 600;

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 sm:p-8 relative">

      <div className="mx-auto max-w-7xl">
        {/* Header & Tabs */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{t("predictions.title")}</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {t("predictions.subtitle").replace("{0}", asset).replace("{1}", modeName)}
            </p>
          </div>
          <div className="flex bg-slate-900 p-1 rounded-xl items-center border border-slate-700/50 shadow-inner">
              <button 
                onClick={() => setType("hourly")}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-black transition-all ${type === "hourly" ? "bg-slate-700 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
              >
                {t("predictions.tab_normal")}
              </button>
              <button 
                onClick={() => setType("mini")}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-black transition-all ${type === "mini" ? "bg-slate-700 text-amber-500 shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
              >
                {t("predictions.tab_mini")}
              </button>
              <button 
                onClick={() => setType("micro")}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-black transition-all ${type === "micro" ? "bg-slate-700 text-sky-400 shadow-lg" : "text-slate-500 hover:text-slate-300 flex items-center gap-1"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                MICRO
              </button>
          </div>
        </div>

        {/* Selector de Activos (BTC, SOL, BOLIS) */}
        <div className="grid grid-cols-3 gap-2 mb-6 sm:flex sm:flex-wrap sm:justify-center">
          {["BTC", "SOL", "BOLIS"].map((a) => (
            <Link 
              key={a}
              href={`/predicciones?asset=${a}`} 
              className={`rounded-xl px-2 py-3 sm:px-8 sm:py-3 text-xs sm:text-sm font-black text-center transition-all border ${
                asset === a 
                  ? "bg-amber-500 text-slate-900 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]" 
                  : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {a}
            </Link>
          ))}
        </div>

        {/* Tarjeta Descriptiva del Juego */}
        <div className="mb-8 animate-in fade-in slide-in-from-left-4 duration-500 text-left relative min-h-[85px]">
           {notification.message ? (
             /* Notificación integrada en el espacio de la guía */
             <div className={`rounded-xl border p-4 border-l-4 shadow-xl flex items-center gap-4 animate-in zoom-in-95 duration-300 ${
               notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/50 border-l-emerald-500 text-emerald-400" : "bg-red-500/10 border-red-500/50 border-l-red-500 text-red-400"
             }`}>
                <div className="flex-shrink-0 mt-0.5">
                   {notification.type === "success" ? (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                     </svg>
                   ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                     </svg>
                   )}
                </div>
                <div>
                   <h4 className="text-xs font-black uppercase tracking-widest mb-0.5">{notification.type === "success" ? "Éxito" : "Atención"}</h4>
                   <p className="text-sm font-bold leading-tight">{notification.message}</p>
                </div>
                <button 
                  onClick={() => setNotification({ message: "", type: null })}
                  className="ml-auto opacity-50 hover:opacity-100 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
             </div>
           ) : (
             /* Tarjeta de Guía Estándar */
             <div className={`rounded-xl border p-4 border-l-4 shadow-xl ${
               type === "micro" ? "bg-amber-500/5 border-slate-700 border-l-amber-500" :
               type === "mini" ? "bg-sky-500/5 border-slate-700 border-l-sky-500" :
               "bg-indigo-500/5 border-slate-700 border-l-indigo-500"
             }`}>
                <div className="flex gap-4">
                   <div className="mt-1 flex-shrink-0">
                      <div className={`p-2 rounded-lg ${
                        type === "micro" ? "bg-amber-500/20 text-amber-500" :
                        type === "mini" ? "bg-sky-500/20 text-sky-500" :
                        "bg-indigo-500/20 text-indigo-500"
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                   </div>
                   <div className="flex-1">
                      <h3 className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                        type === "micro" ? "text-amber-500" : type === "mini" ? "text-sky-500" : "text-indigo-500"
                      }`}>
                        Guía del Modo {type === "hourly" ? "Normal" : type.toUpperCase()}
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed font-medium">
                         {type === "hourly" ? t("predictions.desc_hourly") : type === "mini" ? t("predictions.desc_mini") : t("predictions.desc_micro")}
                      </p>
                   </div>
                </div>
             </div>
           )}
        </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
        {/* Panel Izquierdo: Precio y Tiempo (T1) */}
        <div className="order-1 lg:order-none lg:col-span-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-8 shadow-xl">
            <div className="flex flex-col gap-6 sm:flex-row sm:justify-between sm:items-start mb-6">
                <div className="text-center sm:text-left">
                   <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                       <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                         {t("predictions.price_current").replace("{0}", asset)}
                         <a
                           href={
                               asset === "BOLIS" 
                               ? "https://dexscreener.com/solana/612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha"
                               : asset === "SOL"
                               ? "https://www.coinbase.com/price/solana"
                               : "https://www.coinbase.com/price/bitcoin"
                           }
                           target="_blank"
                           rel="noopener noreferrer"
                           className="text-slate-500 hover:text-amber-400 transition inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-full w-4 h-4 sm:w-5 sm:h-5"
                           title={lang === "es" ? "Ver fuente del precio" : "View price source"}
                         >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 sm:h-3 sm:w-3" viewBox="0 0 20 20" fill="currentColor">
                             <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                             <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                           </svg>
                         </a>
                       </p>
                   </div>
                   <div className="mt-1 flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                     <span className="text-3xl sm:text-5xl font-mono font-bold text-white tracking-tighter">
                       ${data?.current_price.toLocaleString(undefined, { minimumFractionDigits: asset === "BOLIS" ? 6 : asset === "SOL" ? 3 : 2, maximumFractionDigits: asset === "BOLIS" ? 6 : asset === "SOL" ? 3 : 2 })}
                     </span>
                     <span className={`text-lg sm:text-xl font-bold flex items-center ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                       {isUp ? "▲" : "▼"} {Math.abs(diff).toFixed(3)}%
                     </span>
                   </div>
                </div>
                <div className="text-center sm:text-right border-t border-slate-800 pt-4 sm:border-0 sm:pt-0">
                   <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">{t("predictions.round_closing")}</p>
                   <p className="text-2xl sm:text-3xl font-mono font-bold text-amber-400 mt-1">
                     {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                   </p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                    <span>{t("predictions.opening_label")}</span>
                    <span>{t("predictions.progress_label")}</span>
                    <span>{t("predictions.closing_label")}</span>
                </div>
                <div className="h-4 w-full bg-slate-800 rounded-full p-1 border border-slate-700">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${timeLeft < cutoffLimit ? "bg-red-500" : "bg-amber-500"}`} 
                      style={{ width: `${(totalTimeSec - timeLeft) / totalTimeSec * 100}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] sm:text-sm text-slate-400 font-mono">
                    <span>${data?.opening_price.toLocaleString(undefined, { minimumFractionDigits: asset === "BOLIS" ? 6 : asset === "SOL" ? 3 : 2, maximumFractionDigits: asset === "BOLIS" ? 6 : asset === "SOL" ? 3 : 2 })}</span>
                    <span>{data ? new Date(data.end_time).toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour: '2-digit', minute: '2-digit', hour12: false }) : "--:--"}</span>
                </div>
            </div>
          </div>
        </div>

        {/* T2: Historial de Apuestas - Móvil 3ro, PC fila 2 */}
        <div className="order-3 lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden shadow-xl text-left h-full">
            <div className="border-b border-slate-700 bg-slate-800/50 px-6 py-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    {t("predictions.history_title")}
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-800/30 text-slate-500 text-left">
                            <th className="px-3 sm:px-6 py-3 font-bold uppercase tracking-wider text-[10px]">{t("predictions.history_th_date")}</th>
                            <th className="px-3 sm:px-6 py-3 font-bold uppercase tracking-wider text-[10px]">{t("predictions.history_th_asset")}</th>
                            <th className="px-3 sm:px-6 py-3 font-bold uppercase tracking-wider text-[10px]">{t("predictions.history_th_bet")}</th>
                            <th className="px-3 sm:px-6 py-3 font-bold uppercase tracking-wider text-[10px]">{t("predictions.history_th_amount")}</th>
                            <th className="hidden sm:table-cell px-6 py-3 font-bold uppercase tracking-wider text-[10px]">{t("predictions.history_th_odds")}</th>
                            <th className="px-3 sm:px-6 py-3 font-bold uppercase tracking-wider text-right text-[10px]">{t("predictions.history_th_result")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {history.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-slate-500">{t("predictions.history_empty")}</td>
                            </tr>
                        ) : (
                            history.map(bet => {
                                const isResolved = bet.round?.status === "resolved";
                                const win = isResolved && (
                                    bet.type === "micro" 
                                    ? (() => {
                                        const asset = bet.round?.asset || "BTC";
                                        const decimals = asset === "BOLIS" ? 6 : asset === "SOL" ? 3 : 2;
                                        return bet.round?.closing_price?.toFixed(decimals).slice(-1) === bet.prediction;
                                      })()
                                    : (((bet.round?.closing_price || 0) >= (bet.round?.opening_price || 0)) ? "up" : "down") === bet.prediction
                                );
                                return (
                                    <tr 
                                        key={bet.id} 
                                        className="hover:bg-slate-800/50 transition cursor-pointer group"
                                        onClick={() => {
                                            setSelectedBet(bet);
                                            setDetailOpen(true);
                                        }}
                                    >
                                        <td className="px-3 sm:px-6 py-4 font-mono text-[10px] font-bold text-slate-400">
                                            {new Date(bet.created_at).toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { day: '2-digit', month: '2-digit' })} {new Date(bet.created_at).toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour: '2-digit', minute: '2-digit', hour12: false })}
                                        </td>
                                        <td className="px-3 sm:px-6 py-4 font-bold text-slate-300 text-[10px] sm:text-sm">{bet.round?.asset || asset} <span className="text-[9px] text-slate-500 uppercase ml-1">[{bet.type || "hourly"}]</span></td>
                                        <td className="px-3 sm:px-6 py-4">
                                            {bet.prediction === "up" ? (
                                                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">▲</span>
                                            ) : bet.prediction === "down" ? (
                                                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-400">▼</span>
                                            ) : (
                                                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-500">{bet.prediction}</span>
                                            )}
                                        </td>
                                        <td className="px-3 sm:px-6 py-4 font-mono text-slate-300 text-[10px] sm:text-sm">{bet.amount.toLocaleString()}</td>
                                        <td className="hidden sm:table-cell px-6 py-4 font-mono text-slate-400">{bet.odds_at_bet}x</td>
                                        <td className={`px-3 sm:px-6 py-4 text-right font-mono font-bold text-[10px] sm:text-sm ${!isResolved ? "text-slate-500" : win ? "text-emerald-400" : "text-red-400"}`}>
                                            {!isResolved ? "..." : (win ? `+` : `-`)}{isResolved ? Math.abs(win ? (bet.potential_payout - bet.amount) : bet.amount).toLocaleString() : ""}
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

        {/* T3: Panel de Apuesta - Móvil 2do, PC derecha */}
        <div className="order-2 lg:order-none lg:col-span-1 lg:col-start-3 lg:row-start-1">
          <div className="rounded-2xl border border-amber-500/30 bg-slate-900 p-6 shadow-xl relative overflow-hidden h-full text-left">
            <div className="absolute top-0 right-0 p-3 opacity-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
            </div>
            
            <div className="mb-6">
                <p className="text-sm font-bold text-slate-400 uppercase">{t("predictions.balance_title")}</p>
                <p className="text-3xl font-mono font-bold text-amber-400">{balance?.toLocaleString() || "0"} pts</p>
            </div>

            <div className="mb-2">
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wide">{t("predictions.bet_amount_label")}</label>
                <span className="text-[10px] font-black text-amber-500/70 uppercase">Max por nivel: {levelMaxBet.toLocaleString()} pts</span>
              </div>
              <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={levelMaxBet}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-4 pr-12 py-3 sm:py-4 text-xl font-mono text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">PTS</span>
              </div>
              <div className="mt-2 flex gap-2">
                 {[1, 10, 100, 1000].map(v => (
                     <button key={v} onClick={() => setAmount(String(v))} className="flex-1 text-xs py-1.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 transition">
                         {v >= 1000 ? `${v/1000}K` : v}
                     </button>
                 ))}
              </div>
            </div>

            {type === "micro" && (
                <div className="my-4 text-center p-3 sm:p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                        PAGO DINÁMICO ACTUAL
                    </p>
                    <p className="text-3xl sm:text-5xl font-black text-amber-500 font-mono tracking-tighter">
                        x{data?.odds?.micro || "?"}
                    </p>
                </div>
            )}

            {type === "micro" ? (
                <div className="grid grid-cols-5 gap-2 sm:gap-3 py-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                     const decimals = asset === "BOLIS" ? 6 : asset === "SOL" ? 3 : 2;
                     const isCurrentDigit = data ? data.current_price.toFixed(decimals).slice(-1) === String(num) : false;
                     const disabled = betting || !data || timeLeft <= cutoffLimit || isCurrentDigit;
                     return (
                       <button
                         key={num}
                         onClick={() => handleBet(String(num))}
                         disabled={disabled}
                         className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-xl py-3 sm:py-5 text-white transition disabled:opacity-30 ${isCurrentDigit ? "bg-slate-800 border-2 border-slate-700 opacity-50 cursor-not-allowed" : "bg-slate-700 hover:bg-slate-600 border-transparent"}`}
                         title={isCurrentDigit ? "El Oráculo declina apuestas idénticas al precio activo." : `Apostar al número ${num}`}
                       >
                         <span className="text-2xl sm:text-3xl font-black font-mono">{num}</span>
                       </button>
                     )
                  })}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <button
                    onClick={() => handleBet("up")}
                    disabled={betting || !data || timeLeft <= cutoffLimit || (asset === "BOLIS" && type === "mini")}
                    className="group relative flex flex-col items-center justify-center overflow-hidden rounded-xl bg-emerald-600 py-6 text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <span className="text-xs font-black uppercase tracking-widest mb-1 opacity-70">{t("predictions.btn_up")}</span>
                    <span className="text-3xl font-black">{data?.odds?.up || "?"}x</span>
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-emerald-400/50"></div>
                  </button>

                  <button
                    onClick={() => handleBet("down")}
                    disabled={betting || !data || timeLeft <= cutoffLimit || (asset === "BOLIS" && type === "mini")}
                    className="group relative flex flex-col items-center justify-center overflow-hidden rounded-xl bg-red-600 py-6 text-white transition hover:bg-red-500 disabled:opacity-50"
                  >
                    <span className="text-xs font-black uppercase tracking-widest mb-1 opacity-70">{t("predictions.btn_down")}</span>
                    <span className="text-3xl font-black">{data?.odds?.down || "?"}x</span>
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-red-400/50"></div>
                  </button>
                </div>
            )}
            
            {asset === "BOLIS" && type === "mini" && (
                <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                    <p className="text-center text-[11px] text-amber-500 font-bold uppercase leading-tight">
                        {t("predictions.market_locked_admin")}
                    </p>
                </div>
            )}
            
            {data && timeLeft <= cutoffLimit && !(asset === "BOLIS" && type === "mini") && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                  <p className="text-center text-[10px] sm:text-[11px] text-red-500 font-bold uppercase leading-tight">
                    {type === "micro" 
                        ? "Apuestas Bloqueadas. Oráculo Analizando Resultado Final..." 
                        : t("predictions.market_locked_time").replace("{0}", type === "mini" ? "2" : "10")}
                  </p>
              </div>
            )}
          </div>
        </div>

        {/* T4: Resumen de Ganancias - Móvil 4to, PC derecha abajo */}
        <div className="order-4 lg:order-none lg:col-span-1 lg:col-start-3 lg:row-start-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl h-full">
             <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {t("predictions.stats_title")}
             </h3>
             <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50">
                    <span className="text-sm text-slate-400 font-bold">{t("predictions.stats_today")}</span>
                    <span className={`font-mono font-bold ${stats.day >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {stats.day >= 0 ? "+" : ""}{stats.day.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50">
                    <span className="text-sm text-slate-400 font-bold">{t("predictions.stats_week")}</span>
                    <span className={`font-mono font-bold ${stats.week >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {stats.week >= 0 ? "+" : ""}{stats.week.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50">
                    <span className="text-sm text-slate-400 font-bold">{t("predictions.stats_month")}</span>
                    <span className={`font-mono font-bold ${stats.month >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {stats.month >= 0 ? "+" : ""}{stats.month.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <span className="text-sm text-amber-500 font-black uppercase">{t("predictions.stats_total")}</span>
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
        {t("predictions.support_hint")} - v{APP_VERSION}
      </button>

      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        defaultType="dispute"
        userEmail={session?.user?.email ?? ""}
      />

      <BetDetailModal 
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        bet={selectedBet}
      />
      </div>
    </div>
  );
}

export default function PredictionsPage() {
  const { t } = useLang();
  return (
    <Suspense fallback={<div className="py-12 text-slate-400 uppercase font-bold">{t("predictions.loading")}</div>}>
      <PredictionsContent />
    </Suspense>
  );
}
