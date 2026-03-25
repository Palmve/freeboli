"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { SupportModal } from "@/components/SupportModal";
import RollDisplay from "./RollDisplay";
import { MAX_BET_POINTS, MAX_WIN_POINTS } from "@/lib/config";
import { hiLoRuleThresholds } from "@/lib/hilo";
import { useLang } from "@/context/LangContext";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";
/** odds × winChance(%) ≈ 98 (RTP teórico); umbrales HI/LO en servidor según la cuota */
const HOUSE_EDGE_FACTOR = 98;
const ODDS_MIN = 1.01;
const ODDS_MAX = 4900;
const WIN_CHANCE_MIN = 0.02;
const WIN_CHANCE_MAX = 99;
const DEFAULT_HILO_ODDS = "2";
const DEFAULT_HILO_CHANCE = "49.00";

type Tab = "manual" | "auto";
type StrategyTab = "win" | "lose";

/** Copia fija al iniciar AUTO: evita reinicios del bucle al editar el formulario durante la sesión. */
type AutoSessionSnapshot = {
  baseBetNum: number;
  maxBetNum: number;
  rolls: number;
  stopProfit: number | null;
  stopLoss: number | null;
  autoBetOn: "hi" | "lo" | "alternate";
  onWinReturnBase: boolean;
  onWinIncreasePct: string;
  onWinChangeOdds: string;
  onLoseReturnBase: boolean;
  onLoseIncreasePct: string;
  onLoseChangeOdds: string;
  onMaxStop: boolean;
  onMaxReturnBase: boolean;
  onWinNextChoice: "hi" | "lo" | "contrary";
  onLoseNextChoice: "hi" | "lo" | "contrary";
};

type Result = {
  roll: number;
  choice: string;
  win: boolean;
  bet: number;
  payout: number;
  newBalance: number;
  verification?: { server_seed?: string; server_seed_hash: string; client_seed: string; nonce: number };
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
    server_seed?: string;
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
  const [manualBetOdds, setManualBetOdds] = useState(DEFAULT_HILO_ODDS);
  const [manualWinChance, setManualWinChance] = useState(DEFAULT_HILO_CHANCE);
  const [autoBetOdds, setAutoBetOdds] = useState(DEFAULT_HILO_ODDS);
  const [autoWinChance, setAutoWinChance] = useState(DEFAULT_HILO_CHANCE);
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
  const autoSessionRef = useRef<{ snapshot: AutoSessionSnapshot | null; odds: number }>({
    snapshot: null,
    odds: 2,
  });

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
  const oddsNumManual = Math.max(ODDS_MIN, Math.min(ODDS_MAX, Number(manualBetOdds) || 2));
  const oddsNumAuto = Math.max(ODDS_MIN, Math.min(ODDS_MAX, Number(autoBetOdds) || 2));
  const hiLoRules = hiLoRuleThresholds(oddsNumManual);

  function handleManualBetOddsChange(value: string) {
    const v = value.replace(",", ".");
    setManualBetOdds(v);
    const o = parseFloat(v);
    if (Number.isFinite(o) && o >= ODDS_MIN && o <= ODDS_MAX) {
      const c = HOUSE_EDGE_FACTOR / o;
      setManualWinChance(Math.max(WIN_CHANCE_MIN, Math.min(WIN_CHANCE_MAX, c)).toFixed(2));
    }
    lastEditedRef.current = "odds";
  }

  function handleManualWinChanceChange(value: string) {
    const v = value.replace(",", ".");
    setManualWinChance(v);
    const c = parseFloat(v);
    if (Number.isFinite(c) && c >= WIN_CHANCE_MIN && c <= WIN_CHANCE_MAX) {
      const o = HOUSE_EDGE_FACTOR / c;
      setManualBetOdds(Math.max(ODDS_MIN, Math.min(ODDS_MAX, o)).toFixed(2));
    }
    lastEditedRef.current = "chance";
  }

  function handleAutoBetOddsChange(value: string) {
    const v = value.replace(",", ".");
    setAutoBetOdds(v);
    const o = parseFloat(v);
    if (Number.isFinite(o) && o >= ODDS_MIN && o <= ODDS_MAX) {
      const c = HOUSE_EDGE_FACTOR / o;
      setAutoWinChance(Math.max(WIN_CHANCE_MIN, Math.min(WIN_CHANCE_MAX, c)).toFixed(2));
    }
  }

  function handleAutoWinChanceChange(value: string) {
    const v = value.replace(",", ".");
    setAutoWinChance(v);
    const c = parseFloat(v);
    if (Number.isFinite(c) && c >= WIN_CHANCE_MIN && c <= WIN_CHANCE_MAX) {
      const o = HOUSE_EDGE_FACTOR / c;
      setAutoBetOdds(Math.max(ODDS_MIN, Math.min(ODDS_MAX, o)).toFixed(2));
    }
  }

  function selectTab(next: Tab) {
    if (next === tab) return;
    if (next === "manual") {
      setManualBetOdds(DEFAULT_HILO_ODDS);
      setManualWinChance(DEFAULT_HILO_CHANCE);
      if (autoRunning) {
        autoAbortRef.current = true;
        setAutoRunning(false);
      }
    } else {
      setAutoBetOdds(DEFAULT_HILO_ODDS);
      setAutoWinChance(DEFAULT_HILO_CHANCE);
    }
    setTab(next);
  }

  function addToHistory(entry: Omit<HistoryEntry, "id">) {
    const id = `h-${++historyIdRef.current}`;
    setHistory((prev) => [{ ...entry, id }, ...prev].slice(0, 50));
  }

  /** Alinea inputs con la cuota que usará el servidor (clamp + probabilidad). */
  function normalizeManualOddsState() {
    const o = Math.max(ODDS_MIN, Math.min(ODDS_MAX, Number(manualBetOdds) || 2));
    const c = HOUSE_EDGE_FACTOR / o;
    setManualBetOdds(o.toFixed(2));
    setManualWinChance(Math.max(WIN_CHANCE_MIN, Math.min(WIN_CHANCE_MAX, c)).toFixed(2));
    return o;
  }

  function tryApplyStrategyOdds(raw: string) {
    const p = parseFloat(String(raw).replace(",", "."));
    if (!Number.isFinite(p) || p < ODDS_MIN || p > ODDS_MAX) return;
    autoSessionRef.current.odds = p;
  }

  const playOne = useCallback(async (betAmount: number, choiceHiLo: "hi" | "lo", odds: number): Promise<Result | null> => {
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
  }, [t]);

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
    const oddsPlay = normalizeManualOddsState();
    const data = await playOne(amount, c, oddsPlay);
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
      mult: data.win ? oddsPlay : 0,
      profit,
      verification: data.verification,
    });
  }

  useEffect(() => {
    if (!lastResult) return;
    const t = setTimeout(() => setDisplayRoll("0000"), 3000);
    return () => clearTimeout(t);
  }, [lastResult?.roll]);

  // Auto Bet loop: depende solo de autoRunning; parámetros congelados en autoSessionRef al iniciar.
  useEffect(() => {
    if (!autoRunning) return;

    const snap = autoSessionRef.current.snapshot;
    if (!snap) {
      setAutoRunning(false);
      return;
    }

    let currentBet = snap.baseBetNum;
    let rollsLeft = snap.rolls;
    let totalProfit = 0;
    let alternateNext: "hi" | "lo" = "lo";
    let overrideNextChoice: "hi" | "lo" | null = null;

    const run = async () => {
      while (rollsLeft > 0 && !autoAbortRef.current) {
        const choiceToUse =
          overrideNextChoice ?? (snap.autoBetOn === "alternate" ? alternateNext : snap.autoBetOn);
        if (snap.autoBetOn === "alternate" && overrideNextChoice == null) {
          alternateNext = alternateNext === "hi" ? "lo" : "hi";
        }
        overrideNextChoice = null;

        const oddsPlay = autoSessionRef.current.odds;
        const data = await playOne(currentBet, choiceToUse, oddsPlay);
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
          mult: data.win ? oddsPlay : 0,
          profit,
          verification: data.verification,
        });

        if (data.win) {
          if (snap.onWinReturnBase) currentBet = snap.baseBetNum;
          else if (snap.onWinIncreasePct) {
            currentBet = Math.min(
              snap.maxBetNum,
              Math.floor(currentBet * (1 + Number(snap.onWinIncreasePct) / 100)) || snap.baseBetNum
            );
          }
          if (snap.onWinChangeOdds.trim()) tryApplyStrategyOdds(snap.onWinChangeOdds);
        } else {
          if (snap.onLoseReturnBase) currentBet = snap.baseBetNum;
          else if (snap.onLoseIncreasePct) {
            currentBet = Math.min(
              snap.maxBetNum,
              Math.floor(currentBet * (1 + Number(snap.onLoseIncreasePct) / 100)) || snap.baseBetNum
            );
          }
          if (snap.onLoseChangeOdds.trim()) tryApplyStrategyOdds(snap.onLoseChangeOdds);
        }
        if (currentBet > snap.maxBetNum) {
          if (snap.onMaxStop) break;
          if (snap.onMaxReturnBase) currentBet = snap.baseBetNum;
        }

        const nextRule = data.win ? snap.onWinNextChoice : snap.onLoseNextChoice;
        overrideNextChoice =
          nextRule === "hi" ? "hi" : nextRule === "lo" ? "lo" : choiceToUse === "hi" ? "lo" : "hi";

        setAutoRollsPlayed((c) => c + 1);
        setAutoRollsRemaining(rollsLeft - 1);
        setAutoBiggestBet((b) => Math.max(b, currentBet));
        if (data.win) setAutoBiggestWin((w) => Math.max(w, data.payout - data.bet));
        setAutoSessionPL(totalProfit);

        rollsLeft--;
        if (snap.stopProfit != null && totalProfit >= snap.stopProfit) break;
        if (snap.stopLoss != null && totalProfit <= -snap.stopLoss) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      setAutoRunning(false);
      setDisplayRoll("0000");
      setAutoRollsRemaining(0);
    };

    run();
    return () => {
      autoAbortRef.current = true;
    };
    // Snapshot y odds mutables en autoSessionRef al pulsar Iniciar; no re-enlazar al cambiar inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunning, playOne]);

  const startAuto = () => {
    const baseBetNum = Math.floor(Number(autoBaseBet)) || 1;
    const maxBetNum = Math.min(Math.floor(Number(autoMaxBet)) || 100, levelMaxBet); // Clamp al límite del nivel
    const rolls = Math.min(Math.floor(Number(autoNumRolls)) || 10, 10000);
    const spRaw = autoStopProfit ? Math.floor(Number(autoStopProfit)) : null;
    const slRaw = autoStopLoss ? Math.floor(Number(autoStopLoss)) : null;
    const stopProfit = spRaw != null && spRaw > 0 ? spRaw : null;
    const stopLoss = slRaw != null && slRaw > 0 ? slRaw : null;
    const initialOdds = Math.max(ODDS_MIN, Math.min(ODDS_MAX, Number(autoBetOdds) || 2));

    autoSessionRef.current = {
      snapshot: {
        baseBetNum,
        maxBetNum,
        rolls,
        stopProfit,
        stopLoss,
        autoBetOn,
        onWinReturnBase: autoOnWinReturnBase,
        onWinIncreasePct: autoOnWinIncreasePct,
        onWinChangeOdds: autoOnWinChangeOdds,
        onLoseReturnBase: autoOnLoseReturnBase,
        onLoseIncreasePct: autoOnLoseIncreasePct,
        onLoseChangeOdds: autoOnLoseChangeOdds,
        onMaxStop: autoOnMaxStop,
        onMaxReturnBase: autoOnMaxReturnBase,
        onWinNextChoice: autoOnWinNextChoice,
        onLoseNextChoice: autoOnLoseNextChoice,
      },
      odds: initialOdds,
    };

    autoAbortRef.current = false;
    setLastAutoBand(null);
    setAutoRollsPlayed(0);
    setAutoRollsRemaining(rolls);
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
          <span className="text-slate-400 uppercase tracking-widest font-black">{t("hilo.banner_bet_limit_label")}</span>
          <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/20">
            {levelMaxBet.toLocaleString()} {t("account.balance_pts")}
          </span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span className="text-slate-500">
            {t("hilo.banner_max_win", MAX_WIN_POINTS.toLocaleString())}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
        <button
          type="button"
          onClick={() => selectTab("manual")}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
            tab === "manual" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {t("hilo.tab_manual")}
        </button>
        <button
          type="button"
          onClick={() => selectTab("auto")}
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
                {Math.floor(betNum * (oddsNumManual - 1)).toLocaleString()} pts
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
              <p className={`mt-2 text-sm ${Math.floor(betNum * (oddsNumManual - 1)) > MAX_WIN_POINTS ? "text-red-400" : "text-slate-400"}`}>
                {t("hilo.potential_profit")}: {Math.floor(betNum * oddsNumManual).toLocaleString()} pts
                {Math.floor(betNum * (oddsNumManual - 1)) > MAX_WIN_POINTS && ` ${t("hilo.exceeds_limit")}`}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-300 uppercase">{t("hilo.odds_title")}</p>
              <input
                type="number"
                min={ODDS_MIN}
                max={ODDS_MAX}
                step={0.01}
                value={manualBetOdds}
                onChange={(e) => handleManualBetOddsChange(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-amber-400"
              />
              <p className="mt-2 text-sm font-semibold text-slate-300 uppercase">{t("hilo.chance_title")}</p>
              <input
                type="number"
                min={WIN_CHANCE_MIN}
                max={WIN_CHANCE_MAX}
                step={0.01}
                value={manualWinChance}
                onChange={(e) => handleManualWinChanceChange(e.target.value)}
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
                type="number"
                min={ODDS_MIN}
                max={ODDS_MAX}
                step={0.01}
                value={autoBetOdds}
                onChange={(e) => handleAutoBetOddsChange(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-amber-400"
              />
              <p className="mt-2 text-sm font-semibold text-slate-300 uppercase">{t("hilo.auto_chance_title")}</p>
              <input
                type="number"
                min={WIN_CHANCE_MIN}
                max={WIN_CHANCE_MAX}
                step={0.01}
                value={autoWinChance}
                onChange={(e) => handleAutoWinChanceChange(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-amber-400"
              />
              <p className="mt-1 text-xs text-slate-500">{t("hilo.odds_hint")}</p>
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
                <li>{t("hilo.rule_1").replace("{0}", padRoll(hiLoRules.hiMin))}</li>
                <li>{t("hilo.rule_2").replace("{0}", padRoll(hiLoRules.loMax))}</li>
                {hiLoRules.hasDeadZone ? (
                  <li>
                    {t("hilo.rule_3")
                      .replace("{0}", padRoll(hiLoRules.deadMin))
                      .replace("{1}", padRoll(hiLoRules.deadMax))}
                  </li>
                ) : (
                  <li>{t("hilo.rule_3_adjacent")}</li>
                )}
                <li>
                  {t("hilo.rule_4")
                    .replace("{0}", hiLoRules.odds.toFixed(2))
                    .replace("{1}", hiLoRules.winChancePctLabel)}
                </li>
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
                  <p className="text-slate-500 text-[10px] leading-snug mt-1">{t("hilo.strategy_next_overrides_alternate")}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
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
                    <input
                      type="checkbox"
                      checked={autoOnWinReturnBase}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setAutoOnWinReturnBase(on);
                        if (on) setAutoOnWinIncreasePct("");
                      }}
                    />
                    {t("hilo.strategy_return_base")}
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!autoOnWinIncreasePct}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAutoOnWinIncreasePct((prev) => prev || "10");
                          setAutoOnWinReturnBase(false);
                        } else {
                          setAutoOnWinIncreasePct("");
                        }
                      }}
                    />
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
                  <p className="text-slate-500 text-[10px] leading-snug mt-1">{t("hilo.strategy_next_overrides_alternate")}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
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
                    <input
                      type="checkbox"
                      checked={autoOnLoseReturnBase}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setAutoOnLoseReturnBase(on);
                        if (on) setAutoOnLoseIncreasePct("");
                      }}
                    />
                    {t("hilo.strategy_return_base")}
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!autoOnLoseIncreasePct}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAutoOnLoseIncreasePct((prev) => prev || "10");
                          setAutoOnLoseReturnBase(false);
                        } else {
                          setAutoOnLoseIncreasePct("");
                        }
                      }}
                    />
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
                          href={`/hi-lo/verificar?${h.verification.server_seed ? `server_seed=${encodeURIComponent(h.verification.server_seed)}&` : ""}server_seed_hash=${encodeURIComponent(h.verification.server_seed_hash)}&client_seed=${encodeURIComponent(h.verification.client_seed)}&nonce=${h.verification.nonce}`}
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
        {t("hilo.support_hint")}
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
