"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { SupportModal } from "@/components/SupportModal";
import { APP_VERSION } from "@/lib/version";
import RollDisplay from "./RollDisplay";
import { MAX_BET_POINTS, MAX_WIN_POINTS } from "@/lib/config";
import { useLang } from "@/context/LangContext";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";
/** Proporción 49% jugador / 51% casa: odds * winChance = 98 (winChance en %) */
const HOUSE_EDGE_FACTOR = 98; // 98% return => 2% house edge
const ODDS_MIN = 1.01;
const ODDS_MAX = 4900;
const WIN_CHANCE_MIN = 0.02;
const WIN_CHANCE_MAX = 99;

type Tab = "manual" | "auto";
type StrategyTab = "win" | "lose";

type Result = {
  roll: number;
  choice: string;
  win: boolean;
  bet: number;
  payout: number;
  newBalance: number;
  verification?: { server_seed: string; server_seed_hash: string; client_seed: string; nonce: number };
};

type HistoryEntry = {
  id: string;
  time: string;
  choice: "HI" | "LO";
  roll: number;
  stake: number;
  mult: number;
  profit: number;
  verification?: {
    server_seed: string;
    server_seed_hash: string;
    client_seed: string;
    nonce: number;
  };
};

function padRoll(n: number): string {
  return String(n).padStart(4, "0");
}

export default function HiLoPage() {
  const { data: session, status } = useSession();
  const { lang, t } = useLang();
  const [balance, setBalance] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("manual");

  // Manual
  const [bet, setBet] = useState("1");
  const [choice, setChoice] = useState<"hi" | "lo" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<Result | null>(null);
  const [displayRoll, setDisplayRoll] = useState<string>("0000");
  const [betOdds, setBetOdds] = useState("2");
  const [winChance, setWinChance] = useState("49.00");
  const lastEditedRef = useRef<"odds" | "chance">("odds");

  // Auto
  const [autoBaseBet, setAutoBaseBet] = useState("1");
  const [levelMaxBet, setLevelMaxBet] = useState<number>(MAX_BET_POINTS);
  const [autoMaxBet, setAutoMaxBet] = useState("100");
  const [autoNumRolls, setAutoNumRolls] = useState("100");
  const [autoBetOn, setAutoBetOn] = useState<"hi" | "lo" | "alternate">("lo");
  const [autoStopProfit, setAutoStopProfit] = useState("");
  const [autoStopLoss, setAutoStopLoss] = useState("");
  const [autoStrategyTab, setAutoStrategyTab] = useState<StrategyTab>("win");
  const [autoOnWinReturnBase, setAutoOnWinReturnBase] = useState(true);
  const [autoOnWinIncreasePct, setAutoOnWinIncreasePct] = useState("");
  const [autoOnWinChangeOdds, setAutoOnWinChangeOdds] = useState("");
  const [autoOnWinNextChoice, setAutoOnWinNextChoice] = useState<"hi" | "lo" | "contrary">("contrary");
  const [autoOnLoseReturnBase, setAutoOnLoseReturnBase] = useState(true);
  const [autoOnLoseIncreasePct, setAutoOnLoseIncreasePct] = useState("");
  const [autoOnLoseChangeOdds, setAutoOnLoseChangeOdds] = useState("");
  const [autoOnLoseNextChoice, setAutoOnLoseNextChoice] = useState<"hi" | "lo" | "contrary">("contrary");
  const [autoOnMaxReturnBase, setAutoOnMaxReturnBase] = useState(true);
  const [autoOnMaxStop, setAutoOnMaxStop] = useState(false);
  const [autoRollsPlayed, setAutoRollsPlayed] = useState(0);
  const [autoRollsRemaining, setAutoRollsRemaining] = useState(0);
  const [autoBiggestBet, setAutoBiggestBet] = useState(0);
  const [autoBiggestWin, setAutoBiggestWin] = useState(0);
  const [autoSessionPL, setAutoSessionPL] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const autoAbortRef = useRef(false);

  const [lastAutoBand, setLastAutoBand] = useState<{ choice: "HI" | "LO"; win: boolean; profit: number } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [supportOpen, setSupportOpen] = useState(false);
  const historyIdRef = useRef(0);

  function fetchBalance() {
    fetch("/api/faucet")
      .then((r) => r.json())
      .then((d) => setBalance(d.points ?? 0))
      .catch(() => setBalance(0));
  }

  useEffect(() => {
    if (session?.user || !REQUIRE_AUTH) {
      fetchBalance();
      fetch("/api/user/level-stats")
        .then(r => r.json())
        .then(d => {
           if (d.currentLevel) setLevelMaxBet(d.currentLevel.benefits?.maxBetPoints || 500);
        })
        .catch(() => {});
    }
  }, [session?.user]);

  useEffect(() => {
    if (REQUIRE_AUTH && !session?.user) return;
    if (!REQUIRE_AUTH && !session?.user) return;
    fetch("/api/hi-lo/history", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const list = (d.history ?? []).map((h: HistoryEntry & { time: string }) => ({
          ...h,
          id: h.id ?? `h-${h.time}-${h.roll}`,
          time: typeof h.time === "string" ? new Date(h.time).toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour12: false }) : String(h.time),
        }));
        setHistory(list);
      })
      .catch(() => {});
  }, [session?.user, lang]);

  const betNum = Math.floor(Number(bet)) || 0;
  const minBet = 1;
  const maxBet = balance != null ? Math.min(balance, levelMaxBet) : levelMaxBet;
  const oddsNum = Math.max(ODDS_MIN, Math.min(ODDS_MAX, Number(betOdds) || 2));
  const winChanceNum = Math.max(WIN_CHANCE_MIN, Math.min(WIN_CHANCE_MAX, Number(winChance) || 49));

  function handleBetOddsChange(value: string) {
    const v = value.replace(",", ".");
    setBetOdds(v);
    const o = parseFloat(v);
    if (Number.isFinite(o) && o >= ODDS_MIN && o <= ODDS_MAX) {
      const c = HOUSE_EDGE_FACTOR / o;
      setWinChance(Math.max(WIN_CHANCE_MIN, Math.min(WIN_CHANCE_MAX, c)).toFixed(2));
    }
    lastEditedRef.current = "odds";
  }

  function handleWinChanceChange(value: string) {
    const v = value.replace(",", ".");
    setWinChance(v);
    const c = parseFloat(v);
    if (Number.isFinite(c) && c >= WIN_CHANCE_MIN && c <= WIN_CHANCE_MAX) {
      const o = HOUSE_EDGE_FACTOR / c;
      setBetOdds(Math.max(ODDS_MIN, Math.min(ODDS_MAX, o)).toFixed(2));
    }
    lastEditedRef.current = "chance";
  }

  function addToHistory(entry: Omit<HistoryEntry, "id">) {
    const id = `h-${++historyIdRef.current}`;
    setHistory((prev) => [{ ...entry, id }, ...prev].slice(0, 50));
  }

  const playOne = useCallback(async (betAmount: number, choiceHiLo: "hi" | "lo", odds: number = oddsNum): Promise<Result | null> => {
    const res = await fetch("/api/hi-lo/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bet: betAmount, choice: choiceHiLo, odds }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.requireTerms) {
        window.location.href = "/terminos";
        return null;
      }
      setError(data.error || t("hilo.error_generic"));
      return null;
    }
    return data as Result;
  }, [oddsNum, t]);

  async function playManual(overrideChoice?: "hi" | "lo") {
    const amount = Math.floor(Number(bet));
    const c = overrideChoice ?? choice;
    if (!c || amount < 1) {
      setError(t("hilo.error_bet_manual"));
      return;
    }
    setError("");
    setLoading(true);
    setLastResult(null);
    const data = await playOne(amount, c);
    setLoading(false);
    if (!data) {
      setChoice(null); // Clear selection even on error
      return;
    }
    setDisplayRoll(padRoll(data.roll));
    setLastResult(data);
    setBalance(data.newBalance);
    if (typeof window !== "undefined") {
      if (amount >= 1) localStorage.setItem("hilo_last_bet", String(amount));
      window.dispatchEvent(new CustomEvent("freeboli-balance-update", { detail: data.newBalance }));
    }
    setChoice(null);
    const profit = data.win ? data.payout - data.bet : -data.bet;
    addToHistory({
      time: new Date().toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour12: false }),
      choice: c === "hi" ? "HI" : "LO",
      roll: data.roll,
      stake: data.bet,
      mult: data.win ? oddsNum : 0,
      profit,
      verification: data.verification,
    });
  }

  useEffect(() => {
    if (!lastResult) return;
    const t = setTimeout(() => setDisplayRoll("0000"), 3000);
    return () => clearTimeout(t);
  }, [lastResult?.roll]);

  // Auto Bet loop
  useEffect(() => {
    if (!autoRunning) return;

    let currentBet = Math.floor(Number(autoBaseBet)) || 1;
    let rollsLeft = Math.min(Math.floor(Number(autoNumRolls)) || 10, 10000);
    const stopProfit = autoStopProfit ? Math.floor(Number(autoStopProfit)) : null;
    const stopLoss = autoStopLoss ? Math.floor(Number(autoStopLoss)) : null;
    let totalProfit = 0;
    let alternateNext: "hi" | "lo" = "lo";
    let overrideNextChoice: "hi" | "lo" | null = null;

    const run = async () => {
      while (rollsLeft > 0 && !autoAbortRef.current) {
        const choiceToUse = overrideNextChoice ?? (autoBetOn === "alternate" ? alternateNext : autoBetOn);
        if (autoBetOn === "alternate" && overrideNextChoice == null) alternateNext = alternateNext === "hi" ? "lo" : "hi";
        overrideNextChoice = null;

        const data = await playOne(currentBet, choiceToUse);
        if (!data) break;
        setBalance(data.newBalance);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("freeboli-balance-update", { detail: data.newBalance }));
        }
        const profit = data.win ? data.payout - data.bet : -data.bet;
        totalProfit += profit;
        setDisplayRoll(padRoll(data.roll));
        setLastAutoBand({
          choice: choiceToUse === "hi" ? "HI" : "LO",
          win: data.win,
          profit,
        });
        addToHistory({
          time: new Date().toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour12: false }),
          choice: choiceToUse === "hi" ? "HI" : "LO",
          roll: data.roll,
          stake: data.bet,
          mult: data.win ? oddsNum : 0,
          profit,
          verification: data.verification,
        });

        const baseBetNum = Math.floor(Number(autoBaseBet)) || 1;
        const maxBetNum = Math.floor(Number(autoMaxBet)) || 100;
        if (data.win) {
          if (autoOnWinReturnBase) currentBet = baseBetNum;
          else if (autoOnWinIncreasePct) currentBet = Math.min(maxBetNum, Math.floor(currentBet * (1 + Number(autoOnWinIncreasePct) / 100)) || baseBetNum);
        } else {
          if (autoOnLoseReturnBase) currentBet = baseBetNum;
          else if (autoOnLoseIncreasePct) currentBet = Math.min(maxBetNum, Math.floor(currentBet * (1 + Number(autoOnLoseIncreasePct) / 100)) || baseBetNum);
        }
        if (currentBet > maxBetNum) {
          if (autoOnMaxStop) break;
          if (autoOnMaxReturnBase) currentBet = baseBetNum;
        }

        const nextRule = data.win ? autoOnWinNextChoice : autoOnLoseNextChoice;
        overrideNextChoice =
          nextRule === "hi" ? "hi" : nextRule === "lo" ? "lo" : (choiceToUse === "hi" ? "lo" : "hi");

        setAutoRollsPlayed((c) => c + 1);
        setAutoRollsRemaining(rollsLeft - 1);
        setAutoBiggestBet((b) => Math.max(b, currentBet));
        if (data.win) setAutoBiggestWin((w) => Math.max(w, data.payout - data.bet));
        setAutoSessionPL(totalProfit);

        rollsLeft--;
        if (stopProfit != null && totalProfit >= stopProfit) break;
        if (stopLoss != null && totalProfit <= -stopLoss) break;
        await new Promise((r) => setTimeout(r, 600));
      }
      setAutoRunning(false);
      setDisplayRoll("0000");
      setAutoRollsRemaining(0);
    };

    run();
    return () => {
      autoAbortRef.current = true;
    };
  }, [
    autoRunning, 
    autoBaseBet, 
    autoNumRolls, 
    autoStopProfit, 
    autoStopLoss, 
    autoBetOn, 
    lang, 
    oddsNum, 
    playOne, 
    autoMaxBet, 
    autoOnWinReturnBase, 
    autoOnWinIncreasePct, 
    autoOnLoseReturnBase, 
    autoOnLoseIncreasePct, 
    autoOnMaxStop, 
    autoOnMaxReturnBase, 
    autoOnWinNextChoice, 
    autoOnLoseNextChoice
  ]);

  const startAuto = () => {
    autoAbortRef.current = false;
    setLastAutoBand(null);
    setAutoRollsPlayed(0);
    const total = Math.min(Math.floor(Number(autoNumRolls)) || 10, 10000);
    setAutoRollsRemaining(total);
    setAutoBiggestBet(0);
    setAutoBiggestWin(0);
    setAutoSessionPL(0);
    setAutoRunning(true);
  };
  const stopAuto = () => {
    autoAbortRef.current = true;
    setAutoRunning(false);
  };

  if (REQUIRE_AUTH && status === "loading") return <div className="py-12 text-slate-400">{t("hilo.loading")}</div>;
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">{t("hilo.login_hint")}</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">{t("hilo.btn_login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
      {/* Banner */}
      <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-center text-slate-200 sm:px-4 sm:py-3">
        <p className="text-sm font-semibold sm:text-base">{t("hilo.banner_title")}</p>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">
          {t("hilo.banner_desc")}
        </p>
        <div className="mt-1 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs">
          <span className="text-slate-400 uppercase tracking-widest font-black">Tu Límite de Apuesta:</span>
          <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/20">
            {levelMaxBet.toLocaleString()} pts
          </span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span className="text-slate-500">
            Max Ganancia: {MAX_WIN_POINTS.toLocaleString()} pts
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
            tab === "manual" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {t("hilo.tab_manual")}
        </button>
        <button
          type="button"
          onClick={() => setTab("auto")}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
            tab === "auto" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {t("hilo.tab_auto")}
        </button>
      </div>

      {/* Saldo */}
      <div className="rounded-lg bg-slate-800/80 px-3 py-2 text-center sm:px-4">
        <span className="text-slate-400 text-sm">{t("hilo.balance")}: </span>
        <span className="font-mono text-base font-bold text-amber-400 sm:text-lg">
          {balance != null ? balance.toLocaleString() : "—"} {t("hilo.points")}
        </span>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Left panel */}
        <div className="rounded-xl border border-emerald-500/40 bg-slate-800/90 p-4 text-left">
          {tab === "manual" ? (
            <>
              <p className="mb-1 text-sm font-semibold text-slate-300 uppercase">{t("hilo.manual_max_win")}</p>
              <p className="mb-2 rounded border border-slate-600 bg-slate-900/80 px-2 py-1.5 font-mono text-amber-400">
                {Math.floor(betNum * (oddsNum - 1)).toLocaleString()} pts
              </p>
              <p className="mb-2 text-sm font-semibold text-slate-300 uppercase">{t("hilo.manual_bet_amount")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBet(String(Math.max(minBet, Math.floor(betNum / 2))))}
                  className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
                >
                  /2
                </button>
                <button
                  type="button"
                  onClick={() => setBet(String(Math.min(maxBet, Math.floor(betNum * 2) || minBet)))}
                  className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
                >
                  2x
                </button>
                <button
                  type="button"
                  onClick={() => setBet(String(minBet))}
                  className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
                >
                  {t("hilo.btn_min")}
                </button>
                <button
                  type="button"
                  onClick={() => setBet(String(maxBet))}
                  className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
                >
                  {t("hilo.btn_max")}
                </button>
              </div>
              <input
                type="number"
                min={minBet}
                max={maxBet}
                value={bet}
                onChange={(e) => setBet(e.target.value)}
                className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-white"
              />
              <p className={`mt-2 text-sm ${Math.floor(betNum * (oddsNum - 1)) > MAX_WIN_POINTS ? "text-red-400" : "text-slate-400"}`}>
                {t("hilo.potential_profit")}: {Math.floor(betNum * oddsNum).toLocaleString()} pts
                {Math.floor(betNum * (oddsNum - 1)) > MAX_WIN_POINTS && ` ${t("hilo.exceeds_limit")}`}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-300 uppercase">{t("hilo.odds_title")}</p>
              <input
                type="number"
                min={ODDS_MIN}
                max={ODDS_MAX}
                step={0.01}
                value={betOdds}
                onChange={(e) => handleBetOddsChange(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-amber-400"
              />
              <p className="mt-2 text-sm font-semibold text-slate-300 uppercase">{t("hilo.chance_title")}</p>
              <input
                type="number"
                min={WIN_CHANCE_MIN}
                max={WIN_CHANCE_MAX}
                step={0.01}
                value={winChance}
                onChange={(e) => handleWinChanceChange(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-amber-400"
              />
              <p className="mt-1 text-xs text-slate-500">{t("hilo.odds_hint")}</p>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-slate-300 uppercase">{t("hilo.auto_base_bet")}</p>
              <input
                type="number"
                min={1}
                value={autoBaseBet}
                onChange={(e) => setAutoBaseBet(e.target.value)}
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-white"
              />
              <p className="mt-3 text-sm font-semibold text-slate-300 uppercase">{t("hilo.auto_max_bet")}</p>
              <input
                type="number"
                min={1}
                value={autoMaxBet}
                onChange={(e) => setAutoMaxBet(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-white"
              />
              <p className="mt-3 text-sm font-semibold text-slate-300 uppercase">{t("hilo.auto_odds_title")}</p>
              <input
                type="text"
                readOnly
                value={oddsNum.toFixed(2)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900/50 px-3 py-2 font-mono text-slate-400"
              />
              <p className="mt-3 text-sm font-semibold text-slate-300 uppercase">{t("hilo.auto_rolls_title")}</p>
              <input
                type="number"
                min={1}
                max={10000}
                value={autoNumRolls}
                onChange={(e) => setAutoNumRolls(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-white"
              />
              <p className="mt-3 text-sm font-semibold text-slate-300 uppercase">{t("hilo.auto_bet_on")}</p>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="radio" name="autoBetOn" checked={autoBetOn === "hi"} onChange={() => setAutoBetOn("hi")} />
                  {t("hilo.auto_opt_hi")}
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="radio" name="autoBetOn" checked={autoBetOn === "lo"} onChange={() => setAutoBetOn("lo")} />
                  {t("hilo.auto_opt_lo")}
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="radio" name="autoBetOn" checked={autoBetOn === "alternate"} onChange={() => setAutoBetOn("alternate")} />
                  {t("hilo.auto_opt_alternate")}
                </label>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-300 uppercase">{t("hilo.auto_stop_if")}</p>
              <div className="mt-1 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">{t("hilo.auto_stop_profit")}</span>
                  <input
                    type="number"
                    min={0}
                    value={autoStopProfit}
                    onChange={(e) => setAutoStopProfit(e.target.value)}
                    placeholder={t("hilo.auto_optional")}
                    className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">{t("hilo.auto_stop_loss")}</span>
                  <input
                    type="number"
                    min={0}
                    value={autoStopLoss}
                    onChange={(e) => setAutoStopLoss(e.target.value)}
                    placeholder={t("hilo.auto_optional")}
                    className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Centro */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/40 bg-slate-800/90 p-3 sm:p-4">
          <RollDisplay value={displayRoll} animate={displayRoll !== "0000"} />
          <p className="mt-2 text-xs text-slate-500 sm:text-sm">0000-9999</p>

          {tab === "auto" && lastAutoBand && (
            <div
              className={`mt-3 w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white sm:text-base ${
                lastAutoBand.win ? "bg-emerald-500" : "bg-red-500"
              }`}
            >
              {lastAutoBand.win
                ? t("hilo.auto_band_win").replace("{0}", lastAutoBand.choice).replace("{1}", lastAutoBand.profit.toLocaleString())
                : t("hilo.auto_band_loss").replace("{0}", lastAutoBand.choice).replace("{1}", (-lastAutoBand.profit).toLocaleString())}
            </div>
          )}

          {tab === "manual" ? (
            <div className="mt-6 flex w-full max-w-xs gap-4">
              <button
                type="button"
                onClick={() => playManual("hi")}
                disabled={loading || balance == null || balance < betNum || betNum < 1}
                className="flex-1 rounded-lg py-4 font-bold transition bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {t("hilo.btn_bet_hi")}
              </button>
              <button
                type="button"
                onClick={() => playManual("lo")}
                disabled={loading || balance == null || balance < betNum || betNum < 1}
                className="flex-1 rounded-lg py-4 font-bold transition bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {t("hilo.btn_bet_lo")}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 w-full max-w-xs sm:mt-6">
                {!autoRunning ? (
                  <button
                    type="button"
                    onClick={startAuto}
                    disabled={balance == null || balance < (Math.floor(Number(autoBaseBet)) || 1)}
                    className="w-full rounded-lg bg-amber-500 py-3 font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-50 sm:py-4"
                  >
                    {t("hilo.btn_start_auto")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopAuto}
                    className="w-full rounded-lg bg-red-600 py-3 font-bold text-white hover:bg-red-500 sm:py-4"
                  >
                    {t("hilo.btn_stop_auto")}
                  </button>
                )}
              </div>
              <div className="mt-4 w-full space-y-1 rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-left">
                <p className="flex justify-between text-slate-300"><span>{t("hilo.auto_stats_played")}</span> <span className="font-mono">{autoRollsPlayed}</span></p>
                <p className="flex justify-between text-slate-300"><span>{t("hilo.auto_stats_remaining")}</span> <span className="font-mono">{autoRollsRemaining}</span></p>
                <p className="flex justify-between text-slate-300"><span>{t("hilo.auto_stats_biggest_bet")}</span> <span className="font-mono">{autoBiggestBet} {t("hilo.points")}</span></p>
                <p className="flex justify-between text-slate-300"><span>{t("hilo.auto_stats_biggest_win")}</span> <span className="font-mono text-green-400">{autoBiggestWin} {t("hilo.points")}</span></p>
                <p className={`flex justify-between font-medium ${autoSessionPL >= 0 ? "text-green-400" : "text-red-400"}`}>
                  <span>{t("hilo.auto_stats_session_pl")}</span> <span className="font-mono">{autoSessionPL >= 0 ? "+" : ""}{autoSessionPL} {t("hilo.points")}</span>
                </p>
              </div>
            </>
          )}

          {lastResult && tab === "manual" && (
            <p className={`mt-4 text-center text-sm ${lastResult.win ? "text-green-400" : "text-red-400"}`}>
              {lastResult.win
                ? t("hilo.manual_win_msg").replace("{0}", lastResult.payout.toString()).replace("{1}", lastResult.newBalance.toLocaleString())
                : t("hilo.manual_loss_msg").replace("{0}", lastResult.bet.toString()).replace("{1}", lastResult.newBalance.toLocaleString())}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>

        {/* ESTRATEGIA PANEL */}
        <div className="rounded-xl border border-emerald-500/40 bg-slate-800/90 p-3 sm:p-4 text-left">
          {tab === "manual" ? (
            <>
              <p className="text-sm font-semibold text-slate-300 uppercase">{t("hilo.rules_title")}</p>
              <ul className="mt-2 list-inside list-disc text-sm text-slate-400 space-y-1">
                <li>{t("hilo.rule_1")}</li>
                <li>{t("hilo.rule_2")}</li>
                <li>{t("hilo.rule_3")}</li>
                <li>{t("hilo.rule_4")}</li>
              </ul>
              <p className="mt-4 text-xs text-slate-500 sm:text-sm">{t("hilo.rules_pf_hint")}</p>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-slate-300 uppercase">{t("hilo.strategy_title")}</p>
              <div className="flex gap-1 rounded bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => setAutoStrategyTab("win")}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition sm:text-sm ${
                    autoStrategyTab === "win" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t("hilo.strategy_tab_win")}
                </button>
                <button
                  type="button"
                  onClick={() => setAutoStrategyTab("lose")}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition sm:text-sm ${
                    autoStrategyTab === "lose" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t("hilo.strategy_tab_lose")}
                </button>
              </div>
              {autoStrategyTab === "win" ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-slate-400 text-xs font-semibold uppercase">{t("hilo.strategy_next_choice")}</p>
                  <div className="flex flex-wrap gap-2">
                    {(["hi", "lo", "contrary"] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="autoOnWinNextChoice"
                          checked={autoOnWinNextChoice === opt}
                          onChange={() => setAutoOnWinNextChoice(opt)}
                        />
                        {opt === "hi" ? "HI" : opt === "lo" ? "LO" : t("hilo.strategy_opt_contrary")}
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-slate-300 mt-2 cursor-pointer">
                    <input type="checkbox" checked={autoOnWinReturnBase} onChange={(e) => setAutoOnWinReturnBase(e.target.checked)} />
                    {t("hilo.strategy_return_base")}
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={!!autoOnWinIncreasePct} onChange={(e) => setAutoOnWinIncreasePct(e.target.checked ? "10" : "")} />
                    {t("hilo.strategy_increase_pct")}
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={autoOnWinIncreasePct}
                      onChange={(e) => setAutoOnWinIncreasePct(e.target.value)}
                      className="w-14 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-white"
                    />
                    %
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={!!autoOnWinChangeOdds} onChange={(e) => setAutoOnWinChangeOdds(e.target.checked ? "2" : "")} />
                    {t("hilo.strategy_change_odds")}
                    <input
                      type="text"
                      value={autoOnWinChangeOdds}
                      onChange={(e) => setAutoOnWinChangeOdds(e.target.value)}
                      className="w-12 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-white"
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-slate-400 text-xs font-semibold uppercase">{t("hilo.strategy_next_choice")}</p>
                  <div className="flex flex-wrap gap-2">
                    {(["hi", "lo", "contrary"] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="autoOnLoseNextChoice"
                          checked={autoOnLoseNextChoice === opt}
                          onChange={() => setAutoOnLoseNextChoice(opt)}
                        />
                        {opt === "hi" ? "HI" : opt === "lo" ? "LO" : t("hilo.strategy_opt_contrary")}
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-slate-300 mt-2 cursor-pointer">
                    <input type="checkbox" checked={autoOnLoseReturnBase} onChange={(e) => setAutoOnLoseReturnBase(e.target.checked)} />
                    {t("hilo.strategy_return_base")}
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={!!autoOnLoseIncreasePct} onChange={(e) => setAutoOnLoseIncreasePct(e.target.checked ? "10" : "")} />
                    {t("hilo.strategy_increase_pct")}
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={autoOnLoseIncreasePct}
                      onChange={(e) => setAutoOnLoseIncreasePct(e.target.value)}
                      className="w-14 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-white"
                    />
                    %
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={!!autoOnLoseChangeOdds} onChange={(e) => setAutoOnLoseChangeOdds(e.target.checked ? "2" : "")} />
                    {t("hilo.strategy_change_odds")}
                    <input
                      type="text"
                      value={autoOnLoseChangeOdds}
                      onChange={(e) => setAutoOnLoseChangeOdds(e.target.value)}
                      className="w-12 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-white"
                    />
                  </label>
                </div>
              )}
              <p className="mt-4 text-xs font-semibold text-slate-400 uppercase">{t("hilo.strategy_max_bet_reached")}</p>
              <label className="mt-1 flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                <input type="checkbox" checked={autoOnMaxReturnBase} onChange={(e) => setAutoOnMaxReturnBase(e.target.checked)} />
                {t("hilo.strategy_return_base")}
              </label>
              <label className="mt-1 flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                <input type="checkbox" checked={autoOnMaxStop} onChange={(e) => setAutoOnMaxStop(e.target.checked)} />
                {t("hilo.strategy_max_stop")}
              </label>
            </>
          )}
        </div>
      </div>

      {/* Historial */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-4 text-left">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">{t("hilo.history_title")}</h3>
          <span className="text-slate-500 text-sm">{t("hilo.history_date")}: {new Date().toLocaleDateString(lang === "es" ? "es-ES" : "en-US")}</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="pb-2 pr-2">{t("hilo.history_th_time")}</th>
                <th className="pb-2 pr-2">{t("hilo.history_th_choice")}</th>
                <th className="pb-2 pr-2">{t("hilo.history_th_num")}</th>
                <th className="pb-2 pr-2">{t("hilo.history_th_stake")}</th>
                <th className="pb-2 pr-2">{t("hilo.history_th_mult")}</th>
                <th className="pb-2 pr-2 text-right">{t("hilo.history_th_result")}</th>
                <th className="pb-2 pr-2 px-2">{t("hilo.history_th_pf")}</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-500">
                    {t("hilo.history_empty")}
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="border-b border-slate-700/50">
                    <td className="py-2 pr-2 font-mono text-slate-300">{h.time}</td>
                    <td className="py-2 pr-2">{h.choice}</td>
                    <td className="py-2 pr-2 font-mono">{padRoll(h.roll)}</td>
                    <td className="py-2 pr-2 font-mono">{h.stake}</td>
                    <td className="py-2 pr-2 font-mono">{h.mult}</td>
                    <td className={`py-2 pr-2 text-right font-mono ${h.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {h.profit >= 0 ? "+" : ""}{h.profit}
                    </td>
                    <td className="py-2 pr-2 px-2">
                      {h.verification ? (
                        <Link
                          href={`/hi-lo/verificar?server_seed=${encodeURIComponent(h.verification.server_seed)}&server_seed_hash=${encodeURIComponent(h.verification.server_seed_hash)}&client_seed=${encodeURIComponent(h.verification.client_seed)}&nonce=${h.verification.nonce}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline"
                        >
                          {t("hilo.history_link_ver")}
                        </Link>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={() => setSupportOpen(true)}
        className="text-[10px] text-slate-600 hover:text-slate-500 transition mt-8 block mx-auto tracking-normal"
      >
        {t("hilo.support_hint")} - version {APP_VERSION}
      </button>

      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        defaultType="delay"
        userEmail={session?.user?.email ?? ""}
      />
    </div>
  );
}
