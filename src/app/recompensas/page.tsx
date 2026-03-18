"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

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
      setMessage(json.error || "Error al reclamar.");
      return;
    }
    setMessage(`+${json.points} puntos reclamados!`);
    setAchievements((prev) =>
      prev.map((a) => (a.code === code ? { ...a, claimed: true } : a))
    );
  }

  if (REQUIRE_AUTH && status === "loading") {
    return <div className="py-12 text-center text-slate-400">Cargando...</div>;
  }
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">Inicia sesión para ver tus recompensas.</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">Entrar</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <h1 className="text-2xl font-bold text-white">Recompensas</h1>

      {message && (
        <div className={`rounded p-3 text-sm ${message.startsWith("+") ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
          {message}
        </div>
      )}

      {/* Achievements */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-amber-400">Logros</h2>
        <p className="text-sm text-slate-400">Completa objetivos para ganar puntos extra.</p>

        {loading ? (
          <p className="text-slate-500">Cargando logros...</p>
        ) : achievements.length === 0 ? (
          <p className="text-slate-500">No hay logros disponibles.</p>
        ) : (
          <div className="space-y-3">
            {achievements.map((a) => {
              const pct = a.target > 0 ? Math.min((a.progress / a.target) * 100, 100) : 0;
              const ready = a.progress >= a.target && !a.claimed;
              return (
                <div key={a.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-white">{a.name}</h3>
                      <p className="text-sm text-slate-400">{a.description}</p>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span>{a.progress} / {a.target}</span>
                          <span className="text-amber-400 font-medium">+{a.points.toLocaleString()} pts</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${a.claimed ? "bg-green-500" : "bg-amber-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {a.claimed ? (
                        <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-400">
                          Reclamado
                        </span>
                      ) : ready ? (
                        <button
                          onClick={() => claimReward(a.code)}
                          disabled={claiming === a.code}
                          className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
                        >
                          {claiming === a.code ? "..." : "Reclamar"}
                        </button>
                      ) : (
                        <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-400">
                          Pendiente
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
        <h2 className="text-xl font-semibold text-amber-400">Bonificación por rachas del faucet</h2>
        <p className="text-sm text-slate-400">
          Reclama el faucet sin interrupciones para multiplicar tus puntos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Reclamos consecutivos (horas)</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="py-1 text-left">Reclamos</th>
                  <th className="py-1 text-center">Mult.</th>
                  <th className="py-1 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { r: "1 – 3", m: "x1.0", p: "100" },
                  { r: "4 – 6", m: "x1.5", p: "150" },
                  { r: "7 – 12", m: "x2.0", p: "200" },
                  { r: "13 – 24", m: "x2.5", p: "250" },
                  { r: "25+", m: "x3.0", p: "300" },
                ].map((row) => (
                  <tr key={row.r} className="border-b border-slate-700/50">
                    <td className="py-1 text-slate-300">{row.r}</td>
                    <td className="py-1 text-center text-amber-400">{row.m}</td>
                    <td className="py-1 text-right text-white">{row.p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Días seguidos</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="py-1 text-left">Días</th>
                  <th className="py-1 text-right">Bonus</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { d: "1", b: "+0%" },
                  { d: "2 – 3", b: "+10%" },
                  { d: "4 – 7", b: "+25%" },
                  { d: "8 – 14", b: "+50%" },
                  { d: "15 – 30", b: "+75%" },
                  { d: "30+", b: "+100%" },
                ].map((row) => (
                  <tr key={row.d} className="border-b border-slate-700/50">
                    <td className="py-1 text-slate-300">{row.d}</td>
                    <td className="py-1 text-right text-green-400">{row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4 text-sm">
        <Link href="/faucet" className="text-amber-400 hover:underline">Ir al faucet</Link>
        <Link href="/afiliados" className="text-amber-400 hover:underline">Plan afiliados</Link>
      </div>
    </div>
  );
}
