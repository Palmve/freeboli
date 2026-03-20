"use client";

import Link from "next/link";
import { POINTS_PER_BOLIS, MIN_WITHDRAW_POINTS } from "@/lib/config";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  const minBolis = (MIN_WITHDRAW_POINTS / POINTS_PER_BOLIS).toLocaleString();

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-start sm:items-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-2xl my-auto rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-fit sm:max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header del Modal */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
             </div>
             <div>
                <h2 className="text-xl font-bold text-white">Guía para Principiantes</h2>
                <p className="text-xs text-slate-400">Todo lo que necesitas saber sobre FreeBoli</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-2 hover:bg-slate-700 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido Scrollable */}
        <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar text-slate-300">
          
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
              <span>🥑</span> ¿Qué es BOLIS y Solana?
            </h3>
            <p className="text-sm leading-relaxed">
              <strong>BOLIS</strong> es el token oficial de nuestra comunidad en la red de <strong>Solana</strong>. 
              Solana es una blockchain ultra rápida y con comisiones casi inexistentes, lo que permite que tus retiros y depósitos lleguen en segundos.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
              <span>💎</span> ¿Cómo gano BOLIS gratis?
            </h3>
            <p className="text-sm leading-relaxed">
              En FreeBoli puedes acumular fracciones de BOLIS en forma de <strong>Puntos</strong>:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <li className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <span className="text-emerald-400 font-bold">🚰 Faucet:</span> Reclama puntos gratis cada hora.
              </li>
              <li className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <span className="text-emerald-400 font-bold">🏆 Ranking:</span> Premios diarios si eres de los más activos.
              </li>
              <li className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <span className="text-emerald-400 font-bold">📈 Juegos:</span> Multiplica tus puntos en HI-LO y Predicciones.
              </li>
              <li className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <span className="text-emerald-400 font-bold">🎁 Recompensas:</span> Completa misiones para ganar bonus extras.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
              <span>💰</span> Retiros y Equivalencia
            </h3>
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
               <p className="text-sm text-center font-mono">
                 <span className="text-white font-bold">{POINTS_PER_BOLIS.toLocaleString()} Puntos = 1 BOLIS</span>
               </p>
            </div>
            <p className="text-sm leading-relaxed">
              Puedes retirar tus BOLIS cuando alcances un mínimo de <strong>{MIN_WITHDRAW_POINTS.toLocaleString()} puntos</strong> ({minBolis} BOLIS). 
              Necesitarás una wallet de Solana como <strong>Phantom</strong> o <strong>Solflare</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-purple-400 flex items-center gap-2">
              <span>💳</span> Depósitos
            </h3>
            <p className="text-sm leading-relaxed">
              Si quieres jugar con montos mayores, puedes depositar BOLIS desde tu wallet personal. Los puntos se acreditarán automáticamente tras 1 confirmación en la red.
            </p>
          </section>

        </div>

        {/* Footer del Modal */}
        <div className="p-6 border-t border-slate-800 bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link 
            href="/terminos" 
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-amber-400 underline underline-offset-4 transition"
          >
            Leer Condiciones de Uso completas
          </Link>
          <button 
            onClick={onClose}
            className="w-full sm:w-auto bg-amber-500 text-slate-900 font-bold px-8 py-2.5 rounded-lg hover:bg-amber-400 transition transform active:scale-95 shadow-lg shadow-amber-500/20"
          >
            Entendido, ¡a jugar!
          </button>
        </div>

      </div>
    </div>
  );
}
