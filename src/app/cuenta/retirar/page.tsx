"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";
import { translateLevelName } from "@/lib/levels";
import { SupportModal } from "@/components/SupportModal";
import { useLang } from "@/context/LangContext";
import LevelProgressCard from "@/components/LevelProgressCard";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

function translateWithdrawResponse(
  t: (k: string) => string,
  data: { code?: string; params?: (string | number)[]; error?: string }
): string {
  if (!data.code) return data.error || t("withdraw.error_request");
  let msg = t(`withdraw.err_${data.code}`);
  if (msg === `withdraw.err_${data.code}`) return data.error || t("withdraw.error_request"); // sin clave: fallback ES
  (data.params ?? []).forEach((p, i) => { msg = msg.replace(`{${i}}`, String(p)); });
  return msg;
}

export default function RetirarPage() {
  const { data: session, status } = useSession();
  const { t } = useLang();
  const [localUser, setLocalUser] = useState<{ id?: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [levelStats, setLevelStats] = useState<{ maxWithdrawBolis: number; name: string; level: number; icon: string; color: string } | null>(null);
  const [withdrawPoints, setWithdrawPoints] = useState("");
  const [withdrawWallet, setWithdrawWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    if (!REQUIRE_AUTH) {
      fetch("/api/me").then((r) => r.json()).then((d) => setLocalUser(d.user ?? null)).catch(() => setLocalUser(null));
    }
  }, []);

  useEffect(() => {
    if (REQUIRE_AUTH && !session?.user) return;
    if (!REQUIRE_AUTH && !session?.user && !localUser) return;
    fetch("/api/faucet")
      .then((r) => r.json())
      .then((d) => setBalance(d.points ?? 0))
      .catch(() => setBalance(0));
    fetch("/api/user/level-stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.currentLevel) {
          setLevelStats({
            maxWithdrawBolis: d.maxWithdrawBolis ?? d.currentLevel.benefits?.maxWithdrawBolis ?? 10,
            name: d.currentLevel.name,
            level: d.currentLevel.level,
            icon: d.currentLevel.icon,
            color: d.currentLevel.color,
          });
        }
      })
      .catch(() => {});
  }, [session?.user, localUser]);

  const isValidWallet = (w: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w.trim());

  async function requestWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!isValidWallet(withdrawWallet)) {
      setError(t("withdraw.invalid_wallet_solana"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: Number(withdrawPoints),
          wallet: withdrawWallet.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(translateWithdrawResponse(t, data));
        return;
      }
      if (data.autoProcessed) {
        setMessage(t("withdraw.success_auto"));
      } else if (data.autoError) {
        setMessage(t("withdraw.error_auto_fail").replace("{0}", data.autoError));
      } else {
        const reason = data.pendingReason || "manual";
        setMessage(t(`withdraw.pending_${reason}`));
      }
      setWithdrawPoints("");
      setWithdrawWallet("");
      if (data.balance != null) {
        setBalance(data.balance);
        window.dispatchEvent(new CustomEvent("freeboli-balance-update", { detail: data.balance }));
      }
    } catch {
      setLoading(false);
      setError(t("withdraw.error_request"));
    }
  }

  if (REQUIRE_AUTH && status === "loading") return <div className="py-12 text-slate-400">{t("withdraw.loading")}</div>;
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">{t("withdraw.login_hint")}</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">{t("withdraw.btn_login")}</Link>
      </div>
    );
  }
  if (!REQUIRE_AUTH && !localUser && !session) return <div className="py-12 text-slate-400">{t("withdraw.loading")}</div>;

  const isWalletInvalid = withdrawWallet.trim().length > 0 && !isValidWallet(withdrawWallet);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8 px-4 text-left">
      <h1 className="text-2xl font-bold text-white">{t("withdraw.title")}</h1>

      {/* ═══ WIDGET DE NIVEL Y LÍMITES DE RETIRO ═══ */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🎮</span>
          <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">{t("levels.title")}</h2>
        </div>
        <LevelProgressCard compact />

        {/* Tarjeta de límite de retiro por rango */}
        {levelStats && (
          levelStats.maxWithdrawBolis === 0 ? (
            /* ── SIN DERECHO A RETIRO ── */
            <div className="mt-3 rounded-xl bg-red-900/20 border border-red-700/40 p-3">
              <div className="flex items-start gap-2">
                <span className="text-xl mt-0.5">🚫</span>
                <div>
                  <p className="text-sm font-black text-red-300">
                    {t("withdraw.card_blocked_title")
                      .replace("{0}", levelStats.icon)
                      .replace("{1}", translateLevelName(t, levelStats.level, levelStats.name))}
                  </p>
                  <p
                    className="text-xs text-slate-400 mt-1 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: t("withdraw.card_blocked_body") }}
                  />
                  <p
                    className="text-[10px] text-slate-500 mt-1"
                    dangerouslySetInnerHTML={{
                      __html: t("withdraw.card_blocked_unlock")
                        .replace("{0}", "10")
                        .replace("{1}", (10 * POINTS_PER_BOLIS).toLocaleString()),
                    }}
                  />
                </div>
              </div>
              <Link href="/recompensas" className="text-[10px] text-amber-400 hover:underline font-bold mt-2 inline-block">
                {t("withdraw.card_blocked_link")}
              </Link>
            </div>
          ) : (
            /* ── CON ACCESO A RETIRO ── */
            <div className="mt-3 rounded-xl bg-emerald-900/20 border border-emerald-700/30 p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{levelStats.icon}</span>
                  <div>
                    <p className="text-xs text-slate-400">{t("withdraw.card_ok_rank_label")}</p>
                    <p className={`text-sm font-black ${levelStats.color}`}>
                      {translateLevelName(t, levelStats.level, levelStats.name)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">{t("withdraw.card_ok_max_label")}</p>
                  <p className="text-lg font-black text-emerald-400">
                    {levelStats.maxWithdrawBolis}{" "}
                    <span className="text-xs font-medium">{t("withdraw.card_ok_bolis")}</span>
                    <span className="text-xs text-slate-500 ml-1">
                      = {(levelStats.maxWithdrawBolis * POINTS_PER_BOLIS).toLocaleString()} pts
                    </span>
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">{t("withdraw.card_ok_footer")}</p>
              <Link href="/recompensas" className="text-[10px] text-amber-400 hover:underline font-bold mt-1 inline-block">
                {t("withdraw.card_ok_link")}
              </Link>
            </div>
          )
        )}
      </div>

      <div className="card">
        <p className="text-slate-500 text-sm mb-2 font-medium">
          {t("withdraw.rate").replace("{0}", String(POINTS_PER_BOLIS))}
        </p>
        <p className="text-slate-400 text-sm mb-4 font-bold" dangerouslySetInnerHTML={{ __html: t("withdraw.current_balance").replace("{0}", balance != null ? balance.toLocaleString() : "—") }} />
        
        {message && (
          <div className="rounded bg-green-500/20 p-4 text-sm text-green-300 mb-4 border border-green-500/30 font-bold">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded bg-red-500/20 p-4 text-sm text-red-300 mb-4 border border-red-500/30 font-bold">
            {error}
          </div>
        )}

        <form onSubmit={requestWithdraw} className="space-y-5">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5 font-bold uppercase tracking-widest">{t("withdraw.label_points")}</label>
            <input
              type="number"
              min={MIN_WITHDRAW_POINTS}
              step={POINTS_PER_BOLIS}
              value={withdrawPoints}
              onChange={(e) => setWithdrawPoints(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white focus:border-amber-500/50 outline-none transition"
              placeholder={t("withdraw.placeholder_points").replace("{0}", String(MIN_WITHDRAW_POINTS.toLocaleString()))}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5 font-bold uppercase tracking-widest">{t("withdraw.label_wallet")}</label>
            <input
              type="text"
              value={withdrawWallet}
              onChange={(e) => setWithdrawWallet(e.target.value)}
              className={`w-full rounded-xl border ${isWalletInvalid ? 'border-red-500/50' : 'border-slate-700'} bg-slate-800/80 px-4 py-3 font-mono text-sm text-white focus:border-amber-500/50 outline-none transition`}
              placeholder={t("withdraw.placeholder_wallet")}
              required
            />
            {isWalletInvalid && (
              <p className="text-[10px] text-red-400 mt-1 font-bold italic">{t("withdraw.invalid_wallet_solana")}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || balance == null || balance < MIN_WITHDRAW_POINTS || isWalletInvalid}
            className="btn-primary w-full disabled:opacity-50 font-black uppercase tracking-widest py-4 text-sm shadow-lg shadow-amber-500/20 transition transform active:scale-[0.98]"
          >
            {loading ? t("withdraw.sending") : t("withdraw.btn_request")}
          </button>
        </form>
      </div>
      
      <p className="text-center text-sm">
        <Link href="/cuenta" className="text-amber-400 hover:text-amber-300 transition font-bold underline underline-offset-4">
          {t("withdraw.back_account")}
        </Link>
      </p>

      <button
        onClick={() => setSupportOpen(true)}
        className="text-[10px] text-slate-600 hover:text-slate-500 transition mt-8 block mx-auto tracking-normal font-medium"
      >
        {t("withdraw.support_hint")}
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
