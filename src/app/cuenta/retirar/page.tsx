"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";
import { SupportModal } from "@/components/SupportModal";
import { APP_VERSION } from "@/lib/version";
import { useLang } from "@/context/LangContext";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export default function RetirarPage() {
  const { data: session, status } = useSession();
  const { t } = useLang();
  const [localUser, setLocalUser] = useState<{ id?: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
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
  }, [session?.user, localUser]);

  const isValidWallet = (w: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w.trim());

  async function requestWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!isValidWallet(withdrawWallet)) {
        setError("La dirección de billetera no parece ser de la red Solana. Por favor, verifícala.");
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
        setError(data.error || t("withdraw.error_request"));
        return;
      }
      if (data.autoProcessed) {
          setMessage(t("withdraw.success_auto"));
      } else if (data.autoError) {
          setMessage(t("withdraw.error_auto_fail").replace("{0}", data.autoError));
      } else {
          setMessage(t("withdraw.success_manual"));
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
            {isWalletInvalid && <p className="text-[10px] text-red-400 mt-1 font-bold italic">Dirección de red Solana no válida</p>}
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
        {t("withdraw.support_hint")} - v{APP_VERSION}
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
