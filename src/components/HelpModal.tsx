"use client";

import Link from "next/link";
import { POINTS_PER_BOLIS, MIN_WITHDRAW_POINTS } from "@/lib/config";
import { useLang } from "@/context/LangContext";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useLang();
  if (!isOpen) return null;

  const minBolis = (MIN_WITHDRAW_POINTS / POINTS_PER_BOLIS).toLocaleString();

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-start sm:items-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-2xl my-auto rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-fit sm:max-h-[90vh] animate-in zoom-in-95 duration-200 text-left">
        
        {/* Header del Modal */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
             </div>
             <div>
                <h2 className="text-xl font-bold text-white uppercase tracking-tight">{t("help.title")}</h2>
                <p className="text-xs text-slate-400 font-medium">{t("help.subtitle")}</p>
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
            <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2 uppercase tracking-tight">
              {t("help.section1_title")}
            </h3>
            <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: t("help.section1_text") }} />
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-tight">
              {t("help.section2_title")}
            </h3>
            <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: t("help.section2_text") }} />
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <li className="bg-slate-800 p-3 rounded-lg border border-slate-700" dangerouslySetInnerHTML={{ __html: t("help.section2_faucet") }} />
              <li className="bg-slate-800 p-3 rounded-lg border border-slate-700" dangerouslySetInnerHTML={{ __html: t("help.section2_ranking") }} />
              <li className="bg-slate-800 p-3 rounded-lg border border-slate-700" dangerouslySetInnerHTML={{ __html: t("help.section2_games") }} />
              <li className="bg-slate-800 p-3 rounded-lg border border-slate-700" dangerouslySetInnerHTML={{ __html: t("help.section2_rewards") }} />
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2 uppercase tracking-tight">
              {t("help.section3_title")}
            </h3>
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
               <p className="text-sm text-center font-mono" dangerouslySetInnerHTML={{ __html: t("help.section3_rate").replace("{0}", POINTS_PER_BOLIS.toLocaleString()) }} />
            </div>
            <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: t("help.section3_text").replace("{0}", MIN_WITHDRAW_POINTS.toLocaleString()).replace("{1}", minBolis) }} />
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2 uppercase tracking-tight">
              {t("help.section4_title")}
            </h3>
            <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: t("help.section4_text") }} />
          </section>

        </div>

        {/* Footer del Modal */}
        <div className="p-6 border-t border-slate-800 bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link 
            href="/terminos" 
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-amber-400 underline underline-offset-4 transition font-bold uppercase tracking-widest"
          >
            {t("help.footer_terms")}
          </Link>
          <button 
            onClick={onClose}
            className="w-full sm:w-auto bg-amber-500 text-slate-900 font-black px-8 py-2.5 rounded-lg hover:bg-amber-400 transition transform active:scale-95 shadow-lg shadow-amber-500/20 uppercase tracking-widest text-xs"
          >
            {t("help.footer_btn")}
          </button>
        </div>

      </div>
    </div>
  );
}
