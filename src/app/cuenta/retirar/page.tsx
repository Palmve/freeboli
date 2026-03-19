"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export default function RetirarPage() {
  const { data: session, status } = useSession();
  const [localUser, setLocalUser] = useState<{ id?: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [withdrawPoints, setWithdrawPoints] = useState("");
  const [withdrawWallet, setWithdrawWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  async function requestWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
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
      setError(data.error || "Error al solicitar retiro.");
      return;
    }
    setMessage("Retiro solicitado. Se procesará desde Admin.");
    setWithdrawPoints("");
    setWithdrawWallet("");
    if (data.balance != null) {
      setBalance(data.balance);
      window.dispatchEvent(new CustomEvent("freeboli-balance-update", { detail: data.balance }));
    }
  }

  if (REQUIRE_AUTH && status === "loading") return <div className="py-12 text-slate-400">Cargando…</div>;
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">Entra para retirar.</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">Entrar</Link>
      </div>
    );
  }
  if (!REQUIRE_AUTH && !localUser && !session) return <div className="py-12 text-slate-400">Cargando…</div>;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <h1 className="text-2xl font-bold text-white">Retirar BOLIS</h1>
      <div className="card">
        <p className="text-slate-500 text-sm mb-2">
          {String(POINTS_PER_BOLIS)} puntos = 1 BOLIS (retirable cuando alcances el mínimo)
        </p>
        <p className="text-slate-400 text-sm mb-4">
          Balance actual: <span className="font-mono text-amber-400">{balance != null ? balance.toLocaleString() : "—"} pts</span>
        </p>
        {message && (
          <div className="rounded bg-green-500/20 p-2 text-sm text-green-300 mb-4">{message}</div>
        )}
        {error && (
          <div className="rounded bg-red-500/20 p-2 text-sm text-red-300 mb-4">{error}</div>
        )}
        <form onSubmit={requestWithdraw} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Puntos a retirar</label>
            <input
              type="number"
              min={MIN_WITHDRAW_POINTS}
              step={POINTS_PER_BOLIS}
              value={withdrawPoints}
              onChange={(e) => setWithdrawPoints(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              placeholder={`Mínimo ${String(MIN_WITHDRAW_POINTS)}`}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Wallet Solana (destino)</label>
            <input
              type="text"
              value={withdrawWallet}
              onChange={(e) => setWithdrawWallet(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-sm text-white"
              placeholder="Dirección de tu wallet"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || balance == null || balance < MIN_WITHDRAW_POINTS}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Enviando…" : "Solicitar retiro"}
          </button>
        </form>
      </div>
      <p className="text-center text-sm text-slate-500">
        <Link href="/cuenta" className="text-amber-400 hover:underline">Volver a Mi cuenta</Link>
      </p>
    </div>
  );
}
