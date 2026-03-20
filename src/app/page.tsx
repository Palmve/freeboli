"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { POINTS_PER_BOLIS } from "@/lib/config";
import { useLang } from "@/context/LangContext";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export default function HomePage() {
  const { data: session, status } = useSession();
  const { t } = useLang();
  const loggedIn = !!session?.user || !REQUIRE_AUTH;
  const loading = REQUIRE_AUTH && status === "loading";

  return (
    <div className="space-y-16 py-8">
      <section className="text-center">
        <h1 className="mb-4 text-4xl font-black tracking-tighter text-white md:text-6xl drop-shadow-2xl">
          {t("home.title")}
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-400 font-medium">
          {t("home.subtitle")}
          <br />
          <span className="text-amber-500 font-bold">
            {String(POINTS_PER_BOLIS)} {t("home.rate_prefix")}
          </span>
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {loading ? (
            <div className="h-16" />
          ) : loggedIn ? (
            <>
              <Link href="/faucet" className="bg-slate-100 text-slate-900 font-black rounded-xl text-lg px-8 py-4 hover:bg-white transition shadow-xl border-b-4 border-slate-300 active:border-b-0 active:translate-y-1">
                {t("home.btn_faucet")}
              </Link>
              <Link href="/predicciones" className="bg-amber-500 text-slate-950 font-black rounded-xl text-lg px-8 py-4 hover:bg-amber-400 transition shadow-xl shadow-amber-500/20 border-b-4 border-amber-600 active:border-b-0 active:translate-y-1">
                {t("home.btn_prediction")}
              </Link>
              <Link href="/hi-lo" className="bg-slate-800 text-white font-black rounded-xl text-lg px-8 py-4 hover:bg-slate-700 transition shadow-xl border-b-4 border-slate-950 active:border-b-0 active:translate-y-1">
                {t("home.btn_hilo")}
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/registro" className="bg-amber-500 text-slate-950 font-black rounded-xl text-lg px-8 py-4 hover:bg-amber-400 transition shadow-xl shadow-amber-500/20 border-b-4 border-amber-600 active:border-b-0 active:translate-y-1">
                {t("home.btn_play_now")}
              </Link>
              <Link href="/auth/login" className="bg-slate-800 text-white font-black rounded-xl text-lg px-8 py-4 hover:bg-slate-700 transition shadow-xl border-b-4 border-slate-950 active:border-b-0 active:translate-y-1">
                {t("home.btn_login")}
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Predicción BTC */}
        <Link href="/predicciones?asset=BTC" className="card border-l-4 border-amber-500 hover:bg-slate-800/50 transition duration-300 group block">
          <h2 className="mb-2 text-xl font-black text-white flex items-center gap-2 group-hover:text-amber-400 transition">
            <span className="text-amber-500">₿</span> {t("home.btc_pred_title")}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed text-left">
            {t("home.btc_pred_desc")}
          </p>
          <span className="mt-4 inline-block font-black text-amber-500 group-hover:text-amber-400 transition uppercase tracking-tighter text-xs text-left">
            {t("home.btc_pred_link")}
          </span>
        </Link>

        {/* Predicción SOL */}
        <Link href="/predicciones?asset=SOL" className="card border-l-4 border-purple-500 hover:bg-slate-800/50 transition duration-300 group block text-left">
          <h2 className="mb-2 text-xl font-black text-white flex items-center gap-2 group-hover:text-purple-400 transition">
            <span className="text-purple-500">◎</span> {t("home.sol_pred_title")}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            {t("home.sol_pred_desc")}
          </p>
          <span className="mt-4 inline-block font-black text-purple-500 group-hover:text-purple-400 transition uppercase tracking-tighter text-xs">
            {t("home.sol_pred_link")}
          </span>
        </Link>

        {/* Predicción BOLIS */}
        <Link href="/predicciones?asset=BOLIS" className="card border-l-4 border-emerald-500 hover:bg-slate-800/50 transition duration-300 group block text-left">
          <h2 className="mb-2 text-xl font-black text-white flex items-center gap-2 group-hover:text-emerald-400 transition">
            <span className="text-emerald-500">B</span> {t("home.bolis_pred_title")}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            {t("home.bolis_pred_desc")}
          </p>
          <span className="mt-4 inline-block font-black text-emerald-500 group-hover:text-emerald-400 transition uppercase tracking-tighter text-xs">
            {t("home.bolis_pred_link")}
          </span>
        </Link>

        {/* Faucet */}
        <Link href="/faucet" className="card border-l-4 border-slate-400 hover:bg-slate-800/50 transition duration-300 group block text-left">
          <h2 className="mb-2 text-xl font-black text-white group-hover:text-slate-300 transition">
            {t("home.faucet_title")}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            {t("home.faucet_desc")}
          </p>
          <span className="mt-4 inline-block font-black text-slate-300 group-hover:text-white transition uppercase tracking-tighter text-xs">
            {t("home.faucet_link")}
          </span>
        </Link>

        {/* HI-LO */}
        <Link href="/hi-lo" className="card border-l-4 border-slate-500 hover:bg-slate-800/50 transition duration-300 group block text-left">
          <h2 className="mb-2 text-xl font-black text-white group-hover:text-slate-300 transition">
            {t("home.hilo_title")}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            {t("home.hilo_desc")}
          </p>
          <span className="mt-4 inline-block font-black text-slate-300 group-hover:text-white transition uppercase tracking-tighter text-xs">
            {t("home.hilo_link")}
          </span>
        </Link>

        {/* Afiliados */}
        <Link href="/afiliados" className="card border-l-4 border-amber-600/50 hover:bg-slate-800/50 transition duration-300 group block text-left">
          <h2 className="mb-2 text-xl font-black text-white group-hover:text-amber-500 transition">
            {t("home.aff_title")}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            {t("home.aff_desc")}
          </p>
          <span className="mt-4 inline-block font-black text-slate-300 group-hover:text-white transition uppercase tracking-tighter text-xs">
            {t("home.aff_link")}
          </span>
        </Link>
      </section>

      <section className="card max-w-2xl mx-auto text-center border-t border-slate-800 bg-slate-900/50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="mb-2 text-3xl font-black text-white tracking-tight">
          {t("home.footer_title")}
        </h2>
        <p className="text-slate-400 font-medium">
          {t("home.footer_desc")}
        </p>
        <p className="mt-4 text-sm font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 inline-block px-4 py-2 rounded-lg border border-amber-500/20">
          Equivalencia: {String(POINTS_PER_BOLIS)} {t("home.rate_prefix")}
        </p>
      </section>
    </div>
  );
}
