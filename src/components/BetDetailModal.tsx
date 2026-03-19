"use client";

import { useEffect, useState } from "react";

interface BetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bet: any;
}

export function BetDetailModal({ isOpen, onClose, bet }: BetDetailModalProps) {
  if (!isOpen || !bet) return null;

  const isResolved = bet.round?.status === "resolved";
  const win = isResolved && ((bet.round?.closing_price || 0) >= (bet.round?.opening_price || 0) ? "up" : "down") === bet.prediction;
  const isDraw = isResolved && bet.round?.closing_price === bet.round?.opening_price;
  
  const asset = bet.round?.asset || "BTC";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Detalle de Apuesta</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* ID y Estado */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Código ID</p>
                <p className="text-lg font-mono font-bold text-amber-500">{bet.short_id || bet.id.substring(0, 8).toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Estado</p>
                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                  !isResolved ? "bg-slate-800 text-slate-400" :
                  isDraw ? "bg-blue-500/20 text-blue-400" :
                  win ? "bg-emerald-500/20 text-emerald-400" : 
                  "bg-red-500/20 text-red-400"
                }`}>
                  {!isResolved ? "Pendiente" : isDraw ? "Empate (Refund)" : win ? "Ganada" : "Perdida"}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
              <div className="p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">Tu Predicción</p>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-[10px] sm:text-xs font-black uppercase ${bet.prediction === "up" ? "bg-emerald-500 text-slate-900" : "bg-red-500 text-white"}`}>
                    {bet.prediction === "up" ? "Sube ▲" : "Baja ▼"}
                  </span>
                  <span className="text-slate-400 font-bold text-xs sm:text-sm">{bet.odds_at_bet}x</span>
                </div>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">Monto Apostado</p>
                <p className="text-base sm:text-lg font-mono font-black text-white">{bet.amount.toLocaleString()} <span className="text-xs text-slate-500">PTS</span></p>
              </div>
            </div>

            {/* Precios */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
               <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Precio de Apertura ({asset})</p>
                  <p className="text-xl font-mono font-bold text-slate-300">
                    ${bet.round?.opening_price?.toLocaleString(undefined, { minimumFractionDigits: asset === "BOLIS" ? 4 : 2 })}
                  </p>
               </div>
               
               <div className="relative py-2">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-800"></div>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 border-4 border-slate-950"></div>
               </div>

               <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Precio de Cierre</p>
                  <p className={`text-2xl font-mono font-black ${!isResolved ? "text-slate-600 italic" : "text-white"}`}>
                    {isResolved ? `$${bet.round?.closing_price?.toLocaleString(undefined, { minimumFractionDigits: asset === "BOLIS" ? 4 : 2 })}` : "En espera..."}
                  </p>
               </div>
            </div>

            {/* Resultado Final */}
            {isResolved && (
              <div className={`p-4 rounded-xl text-center border ${win ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-800 border-slate-700"}`}>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Resultado Neto</p>
                <p className={`text-2xl font-black ${isDraw ? "text-blue-400" : win ? "text-emerald-400" : "text-red-400"}`}>
                  {isDraw ? "±0 (Reembolsado)" : win ? `+${(bet.potential_payout - bet.amount).toLocaleString()} PTS` : `-${bet.amount.toLocaleString()} PTS`}
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
