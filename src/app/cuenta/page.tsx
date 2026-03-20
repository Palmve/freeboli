"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { POINTS_PER_BOLIS } from "@/lib/config";
import { SupportModal } from "@/components/SupportModal";
import { APP_VERSION } from "@/lib/version";
import { useLang } from "@/context/LangContext";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export default function CuentaPage() {
  const { data: session, status } = useSession();
  const { lang, t, changeLang } = useLang();
  const [localUser, setLocalUser] = useState<{ id?: string } | null>(null);
  const [me, setMe] = useState<{
    user?: { id: string; publicId?: number | null; referralCode?: string | null };
    stats?: { emailVerified?: boolean };
  } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [movements, setMovements] = useState<{ id: string; type: string; points: number; reference: string | null; created_at: string }[]>([]);
  const [supportOpen, setSupportOpen] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [personal, setPersonal] = useState<null | {
    hiLoBets: number;
    faucetEarned: number;
    commissionsEarned: number;
    rankingPrizes: number;
    hiLoPrizes: number;
    rewardsEarned: number;
    paymentsTotal: number;
    depositsTotal: number;
    withdrawalsTotal: number;
    predictionPrizes: number;
  }>(null);

  useEffect(() => {
    if (!REQUIRE_AUTH) {
      fetch("/api/me").then((r) => r.json()).then((d) => setLocalUser(d.user ?? null)).catch(() => setLocalUser(null));
    }
  }, []);

  useEffect(() => {
    if (REQUIRE_AUTH && !session?.user) return;
    if (!REQUIRE_AUTH && !session?.user && !localUser) return;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d))
      .catch(() => setMe(null));
    fetch("/api/cuenta/personal-stats")
      .then((r) => r.json())
      .then((d) => setPersonal(d.stats ?? null))
      .catch(() => setPersonal(null));
  }, [session?.user, localUser]);
  
  useEffect(() => {
    if (REQUIRE_AUTH && !session?.user) return;
    if (!REQUIRE_AUTH && !session?.user && !localUser) return;
    fetch("/api/faucet")
      .then((r) => r.json())
      .then((d) => setBalance(d.points ?? 0))
      .catch(() => setBalance(0));
  }, [session?.user, localUser]);

  useEffect(() => {
    if (REQUIRE_AUTH && !session?.user) return;
    if (!REQUIRE_AUTH && !session?.user && !localUser) return;
    setMovementsLoading(true);
    fetch("/api/cuenta/movements")
      .then((r) => r.json())
      .then((d) => setMovements(d.movements ?? []))
      .catch(() => setMovements([]))
      .finally(() => setMovementsLoading(false));
  }, [session?.user, localUser]);

  if (REQUIRE_AUTH && status === "loading") return <div className="py-12 text-slate-400">{t("account.loading")}</div>;
  
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">{t("account.login_hint")}</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">{t("account.btn_login")}</Link>
      </div>
    );
  }
  
  const userId = (session?.user as { id?: string } | undefined)?.id ?? localUser?.id;
  const referralCode = me?.user?.referralCode || me?.user?.publicId?.toString() || userId || "";
  const emailVerified = me?.stats?.emailVerified ?? true;

  async function resendVerification() {
    setVerifyMsg("");
    setVerifyLoading(true);
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setVerifyLoading(false);
    if (!res.ok) {
      setVerifyMsg(data.error || "Error");
      return;
    }
    setVerifyMsg(data.alreadyVerified ? "Verified" : "Sent");
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8 px-4">
      <h1 className="text-2xl font-bold text-white">{t("account.title")}</h1>

      {/* Language Selector */}
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-slate-300">{t("account.lang_title")}</h2>
        <p className="text-sm text-slate-400">{t("account.lang_desc")}</p>
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button
            onClick={() => changeLang("es")}
            className={`w-full py-3 px-4 rounded-xl border-2 transition-all font-bold flex items-center justify-center gap-3 ${
              lang === "es" 
                ? "border-amber-500 bg-amber-500/10 text-amber-400" 
                : "border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700"
            }`}
          >
            <span className="text-xl">🇪🇸</span> Español
          </button>
          <button
            onClick={() => changeLang("en")}
            className={`w-full py-3 px-4 rounded-xl border-2 transition-all font-bold flex items-center justify-center gap-3 ${
              lang === "en" 
                ? "border-amber-500 bg-amber-500/10 text-amber-400" 
                : "border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700"
            }`}
          >
            <span className="text-xl">🇺🇸</span> English
          </button>
        </div>
      </div>

      {/* Email verification */}
      {!emailVerified && (
        <div id="verificacion" className="card space-y-3 border border-red-500/30 bg-red-500/10">
          <h2 className="text-lg font-semibold text-red-300">{t("account.verify_title")}</h2>
          <p className="text-sm text-slate-300">
            {t("account.verify_desc")}
          </p>
          {verifyMsg && (
            <div className={`rounded p-2 text-sm ${verifyMsg === "Sent" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
              {verifyMsg === "Sent" ? t("account.verify_hint") : verifyMsg}
            </div>
          )}
          <button
            onClick={resendVerification}
            disabled={verifyLoading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {verifyLoading ? t("account.verify_sending") : t("account.verify_btn")}
          </button>
          <p className="text-xs text-slate-400">{t("account.verify_hint")}</p>
        </div>
      )}

      {/* Personal stats */}
      {personal && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-slate-300">{t("account.stats_title")}</h2>
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">{t("account.stat_hilo_bets")}</div>
              <div className="text-xl font-bold text-white">{personal.hiLoBets.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">{t("account.stat_faucet_earned")}</div>
              <div className="text-xl font-bold text-amber-400">{personal.faucetEarned.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">{t("account.stat_aff_comm")}</div>
              <div className="text-xl font-bold text-green-400">{personal.commissionsEarned.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">{t("account.stat_rank_prizes")}</div>
              <div className="text-xl font-bold text-purple-400">{personal.rankingPrizes.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">{t("account.stat_hilo_prizes")}</div>
              <div className="text-xl font-bold text-blue-300">{personal.hiLoPrizes.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">{t("account.stat_pred_prizes")}</div>
              <div className="text-xl font-bold text-amber-500">{personal.predictionPrizes.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">{t("account.stat_rewards")}</div>
              <div className="text-xl font-bold text-white">{personal.rewardsEarned.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">{t("account.stat_deposits")}</div>
              <div className="text-xl font-bold text-white">{personal.depositsTotal.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">{t("account.stat_withdrawals")}</div>
              <div className="text-xl font-bold text-white">{personal.paymentsTotal.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Balance */}
      <div className="card text-left">
        <h2 className="text-lg font-semibold text-slate-300">{t("account.balance_title")}</h2>
        <p className="text-3xl font-bold text-amber-400">
          {balance != null ? balance.toLocaleString() : "—"} {t("account.balance_pts")}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {String(POINTS_PER_BOLIS)} {t("account.balance_rate")}
        </p>
      </div>

      {/* Affiliate link */}
      <div className="card text-left">
        <h2 className="text-lg font-semibold text-slate-300">{t("account.aff_link_title")}</h2>
        <p className="mt-1 text-sm text-slate-400">
          {t("account.aff_link_desc")}
        </p>
        {typeof window !== "undefined" && referralCode && (
          <p className="mt-2 break-all rounded bg-slate-800 p-2 font-mono text-sm text-amber-400">
            {window.location.origin}/auth/registro?ref={referralCode}
          </p>
        )}
      </div>

      {/* Movements History */}
      <div className="card text-left space-y-4">
        <h2 className="text-lg font-semibold text-slate-300">{t("account.history_title")}</h2>
        {movementsLoading ? (
          <p className="text-slate-500 text-sm">{t("account.history_loading")}</p>
        ) : movements.length === 0 ? (
          <p className="text-slate-500 text-sm">{t("account.history_empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <div className="max-h-[220px] overflow-y-auto">
              <table className="w-full text-sm font-sans">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="p-2">{t("account.history_date")}</th>
                    <th className="p-2">{t("account.history_type")}</th>
                    <th className="p-2 text-right">{t("account.history_points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-slate-700/50">
                      <td className="p-2 text-slate-300">
                        {new Date(m.created_at).toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-2">
                        {m.type === "deposito_bolis" ? (
                          <span className="text-green-400">{t("account.history_deposit")}</span>
                        ) : (
                          <span className="text-amber-400">{t("account.history_withdraw")}</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {m.type === "deposito_bolis" ? "+" : "-"}
                        {Number(m.points).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => setSupportOpen(true)}
        className="text-[10px] text-slate-600 hover:text-slate-500 transition mt-8 block mx-auto tracking-normal"
      >
        {t("account.support_hint")} - version {APP_VERSION}
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
