"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/context/LangContext";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  points: number;
  claimed: boolean;
  progress: number;
  target: number;
}

export default function RecompensasPage() {
  const { data: session, status } = useSession();
  const { lang, t } = useLang();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (REQUIRE_AUTH && !session?.user) return;
    fetch("/api/rewards/claim")
      .then((r) => r.json())
      .then((d) => setAchievements(d.achievements ?? []))
      .catch(() => setAchievements([]))
      .finally(() => setLoading(false));
  }, [session?.user]);

  async function claimReward(code: string) {
    setClaiming(code);
    setMessage("");
    const res = await fetch("/api/rewards/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const json = await res.json().catch(() => ({}));
    setClaiming(null);
    if (!res.ok) {
      setMessage(json.error || t("rewards.error_claim"));
      return;
    }
    setMessage(t("rewards.success_claim").replace("{0}", json.points.toLocaleString()));
    setAchievements((prev) =>
      prev.map((a) => (a.code === code ? { ...a, claimed: true } : a))
    );
  }

  if (REQUIRE_AUTH && status === "loading") {
    return <div className="py-12 text-center text-slate-400 font-bold uppercase">{t("rewards.loading")}</div>;
  }
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">{t("rewards.login_hint")}</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">{t("rewards.btn_login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8 text-left">
      <h1 className="text-2xl font-bold text-white">{t("rewards.title")}</h1>

      {message && (
        <div className={`rounded p-3 text-sm font-bold ${message.startsWith("+") ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
          {message}
        </div>
      )}

      {/* Achievements */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-amber-400">{t("rewards.achievements_title")}</h2>
        <p className="text-sm text-slate-400">{t("rewards.achievements_subtitle")}</p>

        {loading ? (
          <p className="text-slate-500 font-bold uppercase">{t("rewards.loading_achievements")}</p>
        ) : achievements.length === 0 ? (
          <p className="text-slate-500 font-bold">{t("rewards.no_achievements")}</p>
        ) : (
          <div className="space-y-3">
            {achievements.map((a) => {
              const pct = a.target > 0 ? Math.min((a.progress / a.target) * 100, 100) : 0;
              const ready = a.progress >= a.target && !a.claimed;
              return (
                <div key={a.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 hover:bg-slate-800 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-white uppercase tracking-tight">{a.name}</h3>
                      <p className="text-sm text-slate-400 mt-1">{a.description}</p>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-bold">
                          <span>{a.progress} / {a.target}</span>
                          <span className="text-amber-400">+{a.points.toLocaleString()} pts</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${a.claimed ? "bg-green-500" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 pt-1">
                      {a.claimed ? (
                        <span className="rounded-full bg-green-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-green-400 border border-green-500/20">
                          {t("rewards.status_claimed")}
                        </span>
                      ) : ready ? (
                        <button
                          onClick={() => claimReward(a.code)}
                          disabled={claiming === a.code}
                          className="btn-primary text-xs px-4 py-2 disabled:opacity-50 font-black uppercase tracking-widest transition shadow-lg shadow-amber-500/20"
                        >
                          {claiming === a.code ? "..." : t("rewards.btn_claim")}
                        </button>
                      ) : (
                        <span className="rounded-full bg-slate-700/50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-600/30">
                          {t("rewards.status_pending")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Streak info tables */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-amber-400">{t("rewards.streak_bonus_title")}</h2>
        <p className="text-sm text-slate-400">
          {t("rewards.streak_bonus_subtitle")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-slate-800/20 p-3 rounded-xl border border-slate-700/50">
            <h3 className="text-xs font-black uppercase text-slate-300 mb-3 tracking-widest">{t("rewards.streak_table_consecutive_title")}</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700 font-black uppercase tracking-tighter">
                  <th className="py-2 text-left">{t("rewards.streak_th_claims")}</th>
                  <th className="py-2 text-center">{t("rewards.streak_th_mult")}</th>
                  <th className="py-2 text-right">{t("rewards.streak_th_points")}</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {[
                  { r: "1 – 3", m: "x1.0", p: "100" },
                  { r: "4 – 6", m: "x1.5", p: "150" },
                  { r: "7 – 12", m: "x2.0", p: "200" },
                  { r: "13 – 24", m: "x2.5", p: "250" },
                  { r: "25+", m: "x3.0", p: "300" },
                ].map((row) => (
                  <tr key={row.r} className="border-b border-slate-700/30 hover:bg-white/5 transition">
                    <td className="py-2 text-slate-300 font-bold">{row.r}</td>
                    <td className="py-2 text-center text-amber-400 font-black">{row.m}</td>
                    <td className="py-2 text-right text-white font-black">{row.p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-800/20 p-3 rounded-xl border border-slate-700/50">
            <h3 className="text-xs font-black uppercase text-slate-300 mb-3 tracking-widest">{t("rewards.streak_table_days_title")}</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700 font-black uppercase tracking-tighter">
                  <th className="py-2 text-left">{t("rewards.streak_th_days")}</th>
                  <th className="py-2 text-right">{t("rewards.streak_th_bonus")}</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {[
                  { d: "1", b: "+0%" },
                  { d: "2 – 3", b: "+10%" },
                  { d: "4 – 7", b: "+25%" },
                  { d: "8 – 14", b: "+50%" },
                  { d: "15 – 30", b: "+75%" },
                  { d: "30+", b: "+100%" },
                ].map((row) => (
                  <tr key={row.d} className="border-b border-slate-700/30 hover:bg-white/5 transition">
                    <td className="py-2 text-slate-300 font-bold">{row.d}</td>
                    <td className="py-2 text-right text-green-400 font-black">{row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-8 text-sm pt-4">
        <Link href="/faucet" className="text-amber-400 hover:underline font-black uppercase tracking-widest">{t("rewards.btn_goto_faucet")}</Link>
        <Link href="/afiliados" className="text-amber-400 hover:underline font-black uppercase tracking-widest">{t("rewards.btn_affiliate_plan")}</Link>
      </div>
    </div>
  );
}
