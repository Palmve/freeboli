"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { SupportModal } from "@/components/SupportModal";
import RollDisplay from "./RollDisplay";
import { MAX_BET_POINTS, MAX_WIN_POINTS } from "@/lib/config";

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
  const [balance, setBalance] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("manual");

  // Manual
  const [bet, setBet] = useState(() => {
    if (typeof window === "undefined") return "10";
    return localStorage.getItem("hilo_last_bet") || "10";
  });
  const [choice, setChoice] = useState<"hi" | "lo" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<Result | null>(null);
  const [displayRoll, setDisplayRoll] = useState<string>("0000");
  const [betOdds, setBetOdds] = useState("2");
  const [winChance, setWinChance] = useState("49.00");
  const lastEditedRef = useRef<"odds" | "chance">("odds");

  // Auto
  const [autoBaseBet, setAutoBaseBet] = useState("10");
  const [autoMaxBet, setAutoMaxBet] = useState("100");
  const [autoNumRolls, setAutoNumRolls] = useState("100");
  const [autoBetOn, setAutoBetOn] = useState<"hi" | "lo" | "alternate">("lo");
  const [autoStopProfit, setAutoStopProfit] = useState("");
  const [autoStopLoss, setAutoStopLoss] = useState("");
  const [autoStrategyTab, setAutoStrategyTab] = useState<StrategyTab>("win");
  const [autoOnWinReturnBase, setAutoOnWinReturnBase] = useState(true);
  const [autoOnWinIncreasePct, setAutoOnWinIncreasePct] = useState("");
  const [autoOnWinChangeOdds, setAutoOnWinChangeOdds] = useState("");
  /** Próxima apuesta al ganar: HI, LO o Contraria (a la que acabamos de apostar). */
  const [autoOnWinNextChoice, setAutoOnWinNextChoice] = useState<"hi" | "lo" | "contrary">("contrary");
  const [autoOnLoseReturnBase, setAutoOnLoseReturnBase] = useState(true);
  const [autoOnLoseIncreasePct, setAutoOnLoseIncreasePct] = useState("");
  const [autoOnLoseChangeOdds, setAutoOnLoseChangeOdds] = useState("");
  /** Próxima apuesta al perder: HI, LO o Contraria. */
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

  // Banda debajo del display en modo AUTO (apuestas HI/LO y resultado)
  const [lastAutoBand, setLastAutoBand] = useState<{ choice: "HI" | "LO"; win: boolean; profit: number } | null>(null);

  // History (last 50)
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
    if (session?.user || !REQUIRE_AUTH) fetchBalance();
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
          time: typeof h.time === "string" ? new Date(h.time).toLocaleTimeString("es-ES", { hour12: false }) : String(h.time),
        }));
        setHistory(list);
      })
      .catch(() => {});
  }, [session?.user]);

  const betNum = Math.floor(Number(bet)) || 0;
  const minBet = 1;
  const maxBet = balance != null ? Math.min(balance, MAX_BET_POINTS) : MAX_BET_POINTS;
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
    setHistory((prev) => [{ ...entry, id }, ...prev].slice(0, 100));
  }

  async function playOne(betAmount: number, choiceHiLo: "hi" | "lo", odds: number = oddsNum): Promise<Result | null> {
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
      setError(data.error || "Error al jugar.");
      return null;
    }
    return data as Result;
  }

  async function playManual(overrideChoice?: "hi" | "lo") {
    const amount = Math.floor(Number(bet));
    const c = overrideChoice ?? choice;
    if (!c || amount < 1) {
      setError("Introduce una apuesta válida y pulsa APUESTA HI o APUESTA LO.");
      return;
    }
    setError("");
    setLoading(true);
    setLastResult(null);
    const data = await playOne(amount, c);
    setLoading(false);
    if (!data) {
      setError("Error al jugar. Revisa tu saldo.");
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
      time: new Date().toLocaleTimeString("es-ES", { hour12: false }),
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
    let rollsLeft = Math.min(Math.floor(Number(autoNumRolls)) || 10, 500);
    const stopProfit = autoStopProfit ? Math.floor(Number(autoStopProfit)) : null;
    const stopLoss = autoStopLoss ? Math.floor(Number(autoStopLoss)) : null;
    let totalProfit = 0;
    let alternateNext: "hi" | "lo" = "lo";
    /** Una sola tirada de override: próxima apuesta según "Al ganar" / "Al perder". */
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
          time: new Date().toLocaleTimeString("es-ES", { hour12: false }),
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
  }, [autoRunning]);

  const startAuto = () => {
    autoAbortRef.current = false;
    setLastAutoBand(null);
    setAutoRollsPlayed(0);
    const total = Math.min(Math.floor(Number(autoNumRolls)) || 10, 500);
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

  if (REQUIRE_AUTH && status === "loading") return <div className="py-12 text-slate-400">Cargando…</div>;
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">Entra para jugar HI-LO.</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">Entrar</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
      {/* Banner */}
      <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-center text-slate-200 sm:px-4 sm:py-3">
        <p className="text-sm font-semibold sm:text-base">Multiplica tus puntos con el juego HI-LO (cuota 1.01 a 4900).</p>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">
          Elige cantidad, apuesta MAYOR (Hi) o MENOR (Lo). Rango 0000-9999. Prob. de acierto segun cuota (ej. 49% con cuota 2).
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Max apuesta: {MAX_BET_POINTS.toLocaleString()} pts | Max ganancia/jugada: {MAX_WIN_POINTS.toLocaleString()} pts
        </p>
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
          APUESTA MANUAL
        </button>
        <button
          type="button"
          onClick={() => setTab("auto")}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
            tab === "auto" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          APUESTA AUTO
        </button>
      </div>

      {/* Saldo en el centro */}
      <div className="rounded-lg bg-slate-800/80 px-3 py-2 text-center sm:px-4">
        <span className="text-slate-400 text-sm">Saldo: </span>
        <span className="font-mono text-base font-bold text-amber-400 sm:text-lg">
          {balance != null ? balance.toLocaleString() : "—"} puntos
        </span>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Left panel */}
        <div className="rounded-xl border border-emerald-500/40 bg-slate-800/90 p-4">
          {tab === "manual" ? (
            <>
              <p className="mb-1 text-sm font-semibold text-slate-300">GANANCIA MÁX. POR APUESTA</p>
              <p className="mb-2 rounded border border-slate-600 bg-slate-900/80 px-2 py-1.5 font-mono text-amber-400">
                {Math.floor(betNum * (oddsNum - 1)).toLocaleString()} pts
              </p>
              <p className="mb-2 text-sm font-semibold text-slate-300">CANTIDAD DE APUESTA</p>
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
                  MÍN
                </button>
                <button
                  type="button"
                  onClick={() => setBet(String(maxBet))}
                  className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
                >
                  MÁX
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
                GANANCIA POTENCIAL: {Math.floor(betNum * oddsNum).toLocaleString()} pts
                {Math.floor(betNum * (oddsNum - 1)) > MAX_WIN_POINTS && " (excede limite)"}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-300">CUOTAS DE APUESTA (?)</p>
              <input
                type="number"
                min={ODDS_MIN}
                max={ODDS_MAX}
                step={0.01}
                value={betOdds}
                onChange={(e) => handleBetOddsChange(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-amber-400"
              />
              <p className="mt-2 text-sm font-semibold text-slate-300">PROBABILIDAD DE GANAR (?)</p>
              <input
                type="number"
                min={WIN_CHANCE_MIN}
                max={WIN_CHANCE_MAX}
                step={0.01}
                value={winChance}
                onChange={(e) => handleWinChanceChange(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-amber-400"
              />
              <p className="mt-1 text-xs text-slate-500">49% jugador / 51% casa. Al cambiar uno se recalcula el otro.</p>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-slate-300">APUESTA BASE</p>
              <input
                type="number"
                min={1}
                value={autoBaseBet}
                onChange={(e) => setAutoBaseBet(e.target.value)}
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-white"
              />
              <p className="mt-3 text-sm font-semibold text-slate-300">APUESTA MÁX. / GANANCIA</p>
              <input
                type="number"
                min={1}
                value={autoMaxBet}
                onChange={(e) => setAutoMaxBet(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-white"
              />
              <p className="mt-3 text-sm font-semibold text-slate-300">CUOTA (usa la de Apuesta manual)</p>
              <input
                type="text"
                readOnly
                value={oddsNum.toFixed(2)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900/50 px-3 py-2 font-mono text-slate-400"
              />
              <p className="mt-3 text-sm font-semibold text-slate-300">Nº DE TIRADAS</p>
              <input
                type="number"
                min={1}
                max={500}
                value={autoNumRolls}
                onChange={(e) => setAutoNumRolls(e.target.value)}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-white"
              />
              <p className="mt-3 text-sm font-semibold text-slate-300">APOSTAR A</p>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="radio" name="autoBetOn" checked={autoBetOn === "hi"} onChange={() => setAutoBetOn("hi")} />
                  HI
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="radio" name="autoBetOn" checked={autoBetOn === "lo"} onChange={() => setAutoBetOn("lo")} />
                  LO
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="radio" name="autoBetOn" checked={autoBetOn === "alternate"} onChange={() => setAutoBetOn("alternate")} />
                  Alternar
                </label>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-300">DEJAR DE APOSTAR SI</p>
              <div className="mt-1 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">Ganancia ≥</span>
                  <input
                    type="number"
                    min={0}
                    value={autoStopProfit}
                    onChange={(e) => setAutoStopProfit(e.target.value)}
                    placeholder="Opcional"
                    className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">Pérdida ≥</span>
                  <input
                    type="number"
                    min={0}
                    value={autoStopLoss}
                    onChange={(e) => setAutoStopLoss(e.target.value)}
                    placeholder="Opcional"
                    className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Centro: display tipo tragamonedas + botones */}
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
                ? `Apuestas ${lastAutoBand.choice} — Ganaste ${lastAutoBand.profit.toLocaleString()} pts`
                : `Apuestas ${lastAutoBand.choice} — Perdiste ${(-lastAutoBand.profit).toLocaleString()} pts`}
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
                APUESTA HI
              </button>
              <button
                type="button"
                onClick={() => playManual("lo")}
                disabled={loading || balance == null || balance < betNum || betNum < 1}
                className="flex-1 rounded-lg py-4 font-bold transition bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
              >
                APUESTA LO
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
                    INICIAR AUTO-APUESTA
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopAuto}
                    className="w-full rounded-lg bg-red-600 py-3 font-bold text-white hover:bg-red-500 sm:py-4"
                  >
                    DETENER AUTO-APUESTA
                  </button>
                )}
              </div>
              <div className="mt-4 w-full space-y-1 rounded-lg bg-slate-900/60 px-3 py-2 text-sm">
                <p className="flex justify-between text-slate-300"><span>Tiradas jugadas:</span> <span className="font-mono">{autoRollsPlayed}</span></p>
                <p className="flex justify-between text-slate-300"><span>Tiradas restantes:</span> <span className="font-mono">{autoRollsRemaining}</span></p>
                <p className="flex justify-between text-slate-300"><span>Mayor apuesta esta sesión:</span> <span className="font-mono">{autoBiggestBet} pts</span></p>
                <p className="flex justify-between text-slate-300"><span>Mayor ganancia esta sesión:</span> <span className="font-mono text-green-400">{autoBiggestWin} pts</span></p>
                <p className={`flex justify-between font-medium ${autoSessionPL >= 0 ? "text-green-400" : "text-red-400"}`}>
                  <span>G/P esta sesión:</span> <span className="font-mono">{autoSessionPL >= 0 ? "+" : ""}{autoSessionPL} pts</span>
                </p>
              </div>
            </>
          )}

          {lastResult && tab === "manual" && (
            <p className={`mt-4 text-center text-sm ${lastResult.win ? "text-green-400" : "text-red-400"}`}>
              {lastResult.win
                ? `Ganaste ${lastResult.payout} pts. Nuevo saldo: ${lastResult.newBalance.toLocaleString()}`
                : `Perdiste ${lastResult.bet} pts. Saldo: ${lastResult.newBalance.toLocaleString()}`}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>

        {/* Panel derecho: Reglas (manual) o Al ganar / Al perder (auto) */}
        <div className="rounded-xl border border-emerald-500/40 bg-slate-800/90 p-3 sm:p-4">
          {tab === "manual" ? (
            <>
              <p className="text-sm font-semibold text-slate-300">Reglas</p>
              <ul className="mt-2 list-inside list-disc text-sm text-slate-400">
                <li>HI: ganas si el número es ≥ 5100</li>
                <li>LO: ganas si el número es ≤ 4899</li>
                <li>4900-5099: gana la casa</li>
                <li>Cuota y probabilidad enlazadas (49% jugador / 51% casa)</li>
              </ul>
              <p className="mt-4 text-xs text-slate-500 sm:text-sm">Tiradas verificables (provably fair): usa el enlace VER del historial.</p>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-slate-300">Estrategia</p>
              <div className="flex gap-1 rounded bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => setAutoStrategyTab("win")}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition sm:text-sm ${
                    autoStrategyTab === "win" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  AL GANAR
                </button>
                <button
                  type="button"
                  onClick={() => setAutoStrategyTab("lose")}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition sm:text-sm ${
                    autoStrategyTab === "lose" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  AL PERDER
                </button>
              </div>
              {autoStrategyTab === "win" ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-slate-400 text-xs font-semibold uppercase">Próxima apuesta al ganar</p>
                  <div className="flex flex-wrap gap-2">
                    {(["hi", "lo", "contrary"] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 text-slate-300">
                        <input
                          type="radio"
                          name="autoOnWinNextChoice"
                          checked={autoOnWinNextChoice === opt}
                          onChange={() => setAutoOnWinNextChoice(opt)}
                        />
                        {opt === "hi" ? "HI" : opt === "lo" ? "LO" : "Contraria"}
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-slate-300 mt-2">
                    <input type="checkbox" checked={autoOnWinReturnBase} onChange={(e) => setAutoOnWinReturnBase(e.target.checked)} />
                    Volver a apuesta base
                  </label>
                  <label className="flex items-center gap-2 text-slate-300">
                    <input type="checkbox" checked={!!autoOnWinIncreasePct} onChange={(e) => setAutoOnWinIncreasePct(e.target.checked ? "10" : "")} />
                    Aumentar apuesta en
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
                  <label className="flex items-center gap-2 text-slate-300">
                    <input type="checkbox" checked={!!autoOnWinChangeOdds} onChange={(e) => setAutoOnWinChangeOdds(e.target.checked ? "2" : "")} />
                    Cambiar cuota a
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
                  <p className="text-slate-400 text-xs font-semibold uppercase">Próxima apuesta al perder</p>
                  <div className="flex flex-wrap gap-2">
                    {(["hi", "lo", "contrary"] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 text-slate-300">
                        <input
                          type="radio"
                          name="autoOnLoseNextChoice"
                          checked={autoOnLoseNextChoice === opt}
                          onChange={() => setAutoOnLoseNextChoice(opt)}
                        />
                        {opt === "hi" ? "HI" : opt === "lo" ? "LO" : "Contraria"}
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-slate-300 mt-2">
                    <input type="checkbox" checked={autoOnLoseReturnBase} onChange={(e) => setAutoOnLoseReturnBase(e.target.checked)} />
                    Volver a apuesta base
                  </label>
                  <label className="flex items-center gap-2 text-slate-300">
                    <input type="checkbox" checked={!!autoOnLoseIncreasePct} onChange={(e) => setAutoOnLoseIncreasePct(e.target.checked ? "10" : "")} />
                    Aumentar apuesta en
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
                  <label className="flex items-center gap-2 text-slate-300">
                    <input type="checkbox" checked={!!autoOnLoseChangeOdds} onChange={(e) => setAutoOnLoseChangeOdds(e.target.checked ? "2" : "")} />
                    Cambiar cuota a
                    <input
                      type="text"
                      value={autoOnLoseChangeOdds}
                      onChange={(e) => setAutoOnLoseChangeOdds(e.target.value)}
                      className="w-12 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-white"
                    />
                  </label>
                </div>
              )}
              <p className="mt-4 text-xs font-semibold text-slate-400">Al alcanzar apuesta máx.</p>
              <label className="mt-1 flex items-center gap-2 text-slate-300 text-sm">
                <input type="checkbox" checked={autoOnMaxReturnBase} onChange={(e) => setAutoOnMaxReturnBase(e.target.checked)} />
                Volver a apuesta base
              </label>
              <label className="mt-1 flex items-center gap-2 text-slate-300 text-sm">
                <input type="checkbox" checked={autoOnMaxStop} onChange={(e) => setAutoOnMaxStop(e.target.checked)} />
                Dejar de apostar
              </label>
            </>
          )}
        </div>
      </div>

      {/* Roll history */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Historial de tiradas</h3>
          <span className="text-slate-500 text-sm">Fecha: {new Date().toLocaleDateString("es-ES")}</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="pb-2 pr-2">Hora</th>
                <th className="pb-2 pr-2">Apuesta</th>
                <th className="pb-2 pr-2">Número</th>
                <th className="pb-2 pr-2">Puntos</th>
                <th className="pb-2 pr-2">Mult.</th>
                <th className="pb-2 pr-2 text-right">Resultado</th>
                <th className="pb-2 pr-2">Verif.</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-500">
                    Aún no hay tiradas. Juega para ver el historial (guardado en la base de datos).
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
                    <td className="py-2 pr-2">
                      {h.verification ? (
                        <Link
                          href={`/hi-lo/verificar?server_seed=${encodeURIComponent(h.verification.server_seed)}&server_seed_hash=${encodeURIComponent(h.verification.server_seed_hash)}&client_seed=${encodeURIComponent(h.verification.client_seed)}&nonce=${h.verification.nonce}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline"
                        >
                          VER
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
        ¿Problemas con el juego? Reportar error o disputa aquí
      </button>

      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        defaultType="error"
        userEmail={session?.user?.email ?? ""}
      />
    </div>
  );
}
