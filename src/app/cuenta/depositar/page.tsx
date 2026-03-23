"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";
import { SupportModal } from "@/components/SupportModal";
import { APP_VERSION } from "@/lib/version";
import { useRouter } from "next/navigation";
import { useLang } from "@/context/LangContext";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export default function DepositarPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useLang();
  const [localOk, setLocalOk] = useState(false);

  useEffect(() => {
    if (!REQUIRE_AUTH) fetch("/api/me", { credentials: "include" }).then((r) => r.json()).then((d) => setLocalOk(!!d.user)).catch(() => setLocalOk(false));
  }, []);

  const [info, setInfo] = useState<{
    address: string;
    pointsPerBolis: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/deposit/address", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (d.address ? setInfo(d) : setInfo(null)))
      .catch(() => setInfo(null));
  }, []);

  async function copyAddress() {
    if (!info?.address) return;
    try {
      await navigator.clipboard.writeText(info.address);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = info.address;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function verifyDeposit() {
    if (verifying) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/deposit/process-incoming", { method: "POST" });
      const data = await res.json();
      if (data.processed > 0) {
        setVerifyResult({ success: true, msg: t("deposit.success_process") });
        if (typeof data.newBalance === "number") {
            window.dispatchEvent(new CustomEvent("freeboli-balance-update", { detail: data.newBalance }));
        }
        setTimeout(() => { router.refresh(); }, 1000);
      } else {
        setVerifyResult({ success: false, msg: t("deposit.no_deposit_found") });
      }
    } catch {
      setVerifyResult({ success: false, msg: t("deposit.error_network") });
    } finally {
      setVerifying(false);
    }
  }

  const minDepositBolis = Math.ceil(MIN_WITHDRAW_POINTS / POINTS_PER_BOLIS);

  if (REQUIRE_AUTH && status === "loading") return <div className="py-12 text-slate-400">{t("deposit.loading")}</div>;
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">{t("deposit.login_hint")}</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">{t("deposit.btn_login")}</Link>
      </div>
    );
  }
  if (!REQUIRE_AUTH && !localOk && !session) return <div className="py-12 text-slate-400">{t("deposit.loading")}</div>;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8 px-4 text-left">
      <h1 className="text-2xl font-bold text-white">{t("deposit.title")}</h1>
      <div className="card space-y-4">
        <p className="text-slate-300" dangerouslySetInnerHTML={{ __html: t("deposit.desc") }} />
        <p className="text-sm text-amber-400 font-bold">
          {info?.pointsPerBolis != null && t("deposit.rate").replace("{0}", info.pointsPerBolis.toLocaleString())}
        </p>
        <p className="text-sm text-slate-400" dangerouslySetInnerHTML={{ __html: t("deposit.min_deposit_hint").replace("{0}", String(minDepositBolis)).replace("{1}", String(MIN_WITHDRAW_POINTS.toLocaleString())) }} />
        
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-200">
           <p dangerouslySetInnerHTML={{ __html: t("deposit.warning") }} />
        </div>

        <p className="text-sm text-slate-300" dangerouslySetInnerHTML={{ 
          __html: t("deposit.swap_link").replace("{0}", "https://dexscreener.com/solana/adtp1djcsfehs4dc7224n67ejtgxawhzj8w7gwtjgwe8") 
        }} />
        
        {info?.address ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">{t("deposit.address_label")}</p>
            <div className="inline-block rounded-lg bg-white p-2">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(info.address)}`}
                alt={t("deposit.qr_alt")}
                width={200}
                height={200}
                className="rounded"
                unoptimized
              />
            </div>
            <div className="rounded-lg bg-slate-800 p-4 font-mono text-sm break-all text-green-400">
              <div className="flex items-start justify-between gap-3">
                <span className="break-all">{info.address}</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="rounded-md bg-slate-700/60 hover:bg-slate-700 px-2 py-1.5 text-slate-200 transition flex-shrink-0"
                  title={t("deposit.copy_btn")}
                >
                  {copied ? (
                    <span className="text-xs font-semibold text-emerald-300">{t("deposit.copied")}</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14h8a2 2 0 002-2V10a2 2 0 00-2-2h-8a2 2 0 00-2 2v2a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-red-400 text-sm font-bold">{t("deposit.error_load_address")}</p>
        )}

        <div className="pt-4 border-t border-slate-800">
           {!verifyResult?.success && (
             <button
               onClick={verifyDeposit}
               disabled={verifying || !info}
               className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition ${
                 verifying ? "bg-slate-800 text-slate-500 cursor-wait" : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20"
               }`}
             >
               {verifying ? (
                 <>
                   <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   {t("deposit.verifying")}
                 </>
               ) : t("deposit.btn_verify")}
             </button>
           )}
           
           {verifyResult && (
             <div className={`mt-3 p-4 rounded-lg bg-opacity-10 text-center font-bold ${verifyResult.success ? "text-emerald-400 bg-emerald-400/10" : "text-amber-400 bg-amber-400/10"}`}>
               {verifyResult.msg}
             </div>
           )}

           {/* ─── NOTA INFORMATIVA ─── */}
           <div className="mt-4 rounded-xl bg-blue-900/20 border border-blue-700/30 p-4 space-y-2">
             <div className="flex items-start gap-2">
               <span className="text-lg mt-0.5">ℹ️</span>
               <div className="flex-1">
                 <p className="text-xs text-blue-300 font-black uppercase tracking-widest mb-1.5">{t("deposit.verify_info_title")}</p>
                 <p className="text-xs text-slate-300 leading-relaxed">
                   {t("deposit.verify_info_desc")}
                 </p>
                 <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                   {t("deposit.verify_info_timing")}
                 </p>
               </div>
             </div>
             <p className="text-[10px] text-slate-500 border-t border-slate-700/50 pt-2">
               {t("deposit.verify_info_support")}
             </p>
           </div>
        </div>
      </div>
      <Link href="/cuenta" className="text-amber-400 hover:underline inline-block font-bold">
        {t("deposit.back_account")}
      </Link>

      <button
        onClick={() => setSupportOpen(true)}
        className="text-[10px] text-slate-600 hover:text-slate-500 transition mt-8 block mx-auto tracking-normal font-medium"
      >
        {t("deposit.support_hint")} - v{APP_VERSION}
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
