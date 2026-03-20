"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_BET_POINTS, MAX_WIN_POINTS, MAX_DAILY_WIN_POINTS, POINTS_PER_BOLIS } from "@/lib/config";
import Link from "next/link";
import { useLang } from "@/context/LangContext";

export default function TerminosPage() {
  const { data: session } = useSession();
  const { t } = useLang();
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    setAccepting(true);
    setError("");
    try {
      const res = await fetch("/api/terms/accept", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAccepted(true);
      } else {
        setError(data.error || t("terms.error_accept"));
      }
    } catch {
      setError(t("terms.error_conn"));
    } finally {
      setAccepting(false);
    }
  }

  const maxBetBolis = (MAX_BET_POINTS / POINTS_PER_BOLIS).toLocaleString();
  const maxWinBolis = (MAX_WIN_POINTS / POINTS_PER_BOLIS).toLocaleString();
  const maxDailyBolis = (MAX_DAILY_WIN_POINTS / POINTS_PER_BOLIS).toLocaleString();

  return (
    <div className="relative mx-auto max-w-3xl space-y-6 py-8 px-4 text-left">
      {/* Botón de cierre superior */}
      <button 
        onClick={() => router.back()}
        className="absolute right-4 top-8 rounded-full bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition"
        title={t("terms.close")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex flex-col gap-1 pr-12">
        <h1 className="text-2xl font-bold text-white">{t("terms.title")}</h1>
        <p className="text-sm text-slate-400 font-medium">{t("terms.updated")}</p>
      </div>

      <div className="card space-y-5 text-sm text-slate-300 leading-relaxed border-slate-700/50">
        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.nature_title")}</h2>
          <p>
            {t("terms.nature_text").replace("{0}", String(POINTS_PER_BOLIS))}
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.limits_title")}</h2>
          <ul className="list-disc list-inside space-y-2 ml-1">
            <li dangerouslySetInnerHTML={{ __html: t("terms.limit_max_bet").replace("{0}", MAX_BET_POINTS.toLocaleString()).replace("{1}", maxBetBolis) }} />
            <li dangerouslySetInnerHTML={{ __html: t("terms.limit_max_win").replace("{0}", MAX_WIN_POINTS.toLocaleString()).replace("{1}", maxWinBolis) }} />
            <li dangerouslySetInnerHTML={{ __html: t("terms.limit_max_daily").replace("{0}", MAX_DAILY_WIN_POINTS.toLocaleString()).replace("{1}", maxDailyBolis) }} />
            <li className="text-slate-500 font-medium italic">{t("terms.limit_adjust_hint")}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.fair_title")}</h2>
          <p>{t("terms.fair_text")}</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.conduct_title")}</h2>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            {Array.isArray(t("terms.conduct_list")) && (t("terms.conduct_list") as any as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.sanctions_title")}</h2>
          <p>{t("terms.sanctions_text")}</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.transac_title")}</h2>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            {Array.isArray(t("terms.transac_list")) && (t("terms.transac_list") as any as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.faucet_title")}</h2>
          <p>{t("terms.faucet_text")}</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.aff_title")}</h2>
          <p>{t("terms.aff_text")}</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.resp_title")}</h2>
          <p>{t("terms.resp_text")}</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.mods_title")}</h2>
          <p>{t("terms.mods_text")}</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-400 mb-2 uppercase tracking-tight">{t("terms.age_title")}</h2>
          <p>{t("terms.age_text")}</p>
        </div>
      </div>

      {session?.user && !accepted && (
        <div className="card text-center space-y-4 border-amber-500/30 bg-amber-500/5 shadow-xl shadow-amber-500/5">
          {error && <p className="text-red-400 text-sm font-bold">{error}</p>}
          <p className="text-slate-300 font-medium">
            {t("terms.accept_confirm")}
          </p>
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="btn-primary w-full max-w-xs mx-auto disabled:opacity-50 font-black uppercase tracking-widest py-3 text-sm transition shadow-lg shadow-amber-500/20"
          >
            {accepting ? t("terms.processing") : t("terms.btn_accept")}
          </button>
        </div>
      )}

      {accepted && (
        <div className="card text-center space-y-5 border-green-500/30 bg-green-500/5">
          <p className="text-green-400 font-black uppercase tracking-tight">{t("terms.status_accepted")}</p>
          <Link href="/hi-lo" className="btn-primary inline-block px-8 py-2.5 font-black uppercase tracking-widest text-sm shadow-lg shadow-amber-500/10">
            {t("terms.btn_back_game")}
          </Link>
        </div>
      )}

      {!accepted && (
        <div className="text-center pb-8 pt-4">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-white transition text-xs font-black uppercase tracking-widest">
            {t("terms.btn_back_prev")}
          </button>
        </div>
      )}
    </div>
  );
}
