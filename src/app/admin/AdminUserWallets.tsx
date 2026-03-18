"use client";

import { useEffect, useState, useCallback } from "react";

interface WalletInfo {
  userId: string;
  email: string;
  name: string | null;
  address: string;
  bolisBalance: number;
}

interface SweepResult {
  userId: string;
  address: string;
  bolis: number;
  status: "swept" | "skipped" | "error";
  txSignature?: string;
  error?: string;
}

export default function AdminUserWallets() {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [totalBolis, setTotalBolis] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sweeping, setSweeping] = useState(false);
  const [sweepResults, setSweepResults] = useState<SweepResult[] | null>(null);
  const [sweepError, setSweepError] = useState("");
  const [sweepSummary, setSweepSummary] = useState<{ swept: number; totalBolis: number } | null>(null);

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/user-wallets", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al cargar wallets.");
        return;
      }
      setWallets(data.wallets ?? []);
      setTotalBolis(data.totalBolis ?? 0);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  async function handleSweepAll() {
    if (!confirm("¿Transferir todos los BOLIS de las wallets de depósito al treasury? El treasury pagará el gas.")) return;
    setSweeping(true);
    setSweepError("");
    setSweepResults(null);
    setSweepSummary(null);
    try {
      const res = await fetch("/api/admin/sweep-wallets", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setSweepError(data.error || "Error al hacer sweep.");
        return;
      }
      setSweepResults(data.results ?? []);
      setSweepSummary({ swept: data.swept ?? 0, totalBolis: data.totalBolis ?? 0 });
      fetchWallets();
    } catch {
      setSweepError("Error de conexión.");
    } finally {
      setSweeping(false);
    }
  }

  const walletsWithBalance = wallets.filter((w) => w.bolisBalance > 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-slate-300">Wallets de depósito (usuarios)</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchWallets}
            disabled={loading}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={handleSweepAll}
            disabled={sweeping || walletsWithBalance.length === 0}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {sweeping ? "Procesando…" : `Sweep al Treasury (${walletsWithBalance.length})`}
          </button>
        </div>
      </div>

      {totalBolis > 0 && (
        <p className="mt-2 text-sm text-amber-400">
          Total BOLIS en wallets de usuarios: <strong>{totalBolis.toFixed(4)}</strong>
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {!loading && wallets.length === 0 && !error && (
        <p className="mt-4 text-slate-500">No hay wallets de depósito creadas.</p>
      )}

      {wallets.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pr-4">Usuario</th>
                <th className="pr-4">Dirección depósito</th>
                <th className="pr-4 text-right">BOLIS</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.userId} className="border-t border-slate-700">
                  <td className="py-1.5 pr-4">
                    <span className="text-white">{w.email}</span>
                    {w.name && <span className="ml-2 text-xs text-slate-500">({w.name})</span>}
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-xs text-slate-400 truncate max-w-[200px]" title={w.address}>
                    {w.address.slice(0, 6)}…{w.address.slice(-6)}
                  </td>
                  <td className={`py-1.5 pr-4 text-right font-mono ${w.bolisBalance > 0 ? "text-green-400 font-semibold" : "text-slate-500"}`}>
                    {w.bolisBalance.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sweepError && <p className="mt-3 text-sm text-red-400">{sweepError}</p>}

      {sweepSummary && (
        <div className="mt-3 rounded-lg bg-slate-800 p-3 text-sm">
          <p className="text-green-400">
            Sweep completado: <strong>{sweepSummary.swept}</strong> wallet(s), <strong>{sweepSummary.totalBolis.toFixed(4)}</strong> BOLIS transferidos al treasury.
          </p>
        </div>
      )}

      {sweepResults && sweepResults.length > 0 && (
        <div className="mt-2 border-t border-slate-600 pt-2 text-xs text-slate-400 max-h-48 overflow-y-auto">
          <p className="font-medium text-slate-300 mb-1">Detalle del sweep:</p>
          {sweepResults
            .filter((r) => r.status !== "skipped")
            .map((r, i) => (
              <div key={i} className="mt-0.5 font-mono">
                <span title={r.address}>…{r.address.slice(-8)}</span>
                {" · "}
                {r.status === "swept" && (
                  <span className="text-green-400">{r.bolis.toFixed(4)} BOLIS — tx: {r.txSignature?.slice(0, 12)}…</span>
                )}
                {r.status === "error" && (
                  <span className="text-red-400">Error: {r.error}</span>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
