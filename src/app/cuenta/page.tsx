"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export default function CuentaPage() {
  const { data: session, status } = useSession();
  const [localUser, setLocalUser] = useState<{ id?: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [withdrawPoints, setWithdrawPoints] = useState("");
  const [withdrawWallet, setWithdrawWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [movements, setMovements] = useState<{ id: string; type: string; points: number; reference: string | null; created_at: string }[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);

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
    if (data.balance != null) setBalance(data.balance);
  }

  if (REQUIRE_AUTH && status === "loading") return <div className="py-12 text-slate-400">Cargando…</div>;
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">Entra para ver tu cuenta.</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">Entrar</Link>
      </div>
    );
  }
  const userId = (session?.user as { id?: string } | undefined)?.id ?? localUser?.id;

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      <h1 className="text-2xl font-bold text-white">Mi cuenta</h1>
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-300">Balance</h2>
        <p className="text-3xl font-bold text-amber-400">
          {balance != null ? balance.toLocaleString() : "—"} puntos
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {String(POINTS_PER_BOLIS)} puntos = 1 BOLIS (retirable cuando alcances el mínimo)
        </p>
      </div>
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-300">Enlace de afiliado</h2>
        <p className="mt-1 text-sm text-slate-400">
          Comparte este enlace: quien se registre con él te dará comisión de por vida.
        </p>
        {typeof window !== "undefined" && userId && (
          <p className="mt-2 break-all rounded bg-slate-800 p-2 font-mono text-sm text-amber-400">
            {window.location.origin}/auth/registro?ref={userId}
          </p>
        )}
      </div>
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-300">Historial de depósitos y retiros</h2>
        {movementsLoading ? (
          <p className="text-slate-500 text-sm">Cargando…</p>
        ) : movements.length === 0 ? (
          <p className="text-slate-500 text-sm">Aún no hay depósitos ni retiros.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <div className="max-h-[220px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2 text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-slate-700/50">
                      <td className="p-2 text-slate-300">{new Date(m.created_at).toLocaleString()}</td>
                      <td className="p-2">
                        {m.type === "deposito_bolis" ? (
                          <span className="text-green-400">Depósito</span>
                        ) : (
                          <span className="text-amber-400">Retiro</span>
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
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-300">Agregar puntos (depósito BOLIS)</h2>
        <p className="text-slate-400 text-sm">
          Envía BOLIS a la dirección que se muestra en la sección Depósito. Tras confirmar la
          transacción en Solana, los puntos se acreditarán.
        </p>
        <p className="text-slate-500 text-sm">
          {String(POINTS_PER_BOLIS)} puntos = 1 BOLIS (retirable cuando alcances el mínimo)
        </p>
        <Link href="/cuenta/depositar" className="btn-secondary inline-block">
          Ver dirección de depósito
        </Link>
      </div>
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-300">Retirar BOLIS</h2>
        <p className="text-slate-500 text-sm">
          {String(POINTS_PER_BOLIS)} puntos = 1 BOLIS (retirable cuando alcances el mínimo)
        </p>
        {message && (
          <div className="rounded bg-green-500/20 p-2 text-sm text-green-300">{message}</div>
        )}
        {error && (
          <div className="rounded bg-red-500/20 p-2 text-sm text-red-300">{error}</div>
        )}
        <form onSubmit={requestWithdraw}>
          <div className="space-y-2">
            <label className="block text-sm text-slate-400">Puntos a retirar</label>
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
          <div className="mt-2 space-y-2">
            <label className="block text-sm text-slate-400">Wallet Solana (destino)</label>
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
            className="btn-primary mt-4 w-full disabled:opacity-50"
          >
            {loading ? "Enviando…" : "Solicitar retiro"}
          </button>
        </form>
      </div>
    </div>
  );
}
