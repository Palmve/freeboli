"use client";

import { useEffect, useState } from "react";
import AdminWithdrawSettings from "../AdminWithdrawSettings";

type Withdrawal = {
  id: string;
  user_id: string;
  points: number;
  wallet_destination: string;
  status: string;
  created_at: string;
  tx_signature?: string;
};

export default function AdminRetirosPage() {
  const [list, setList] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/withdrawals")
      .then((r) => r.json())
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  async function process(id: string) {
    setProcessing(id);
    const res = await fetch("/api/admin/process-withdrawal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withdrawalId: id }),
    });
    const data = await res.json().catch(() => ({}));
    setProcessing(null);
    if (res.ok) {
      setList((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, status: "completed", tx_signature: data.txSignature } : w
        )
      );
    } else {
      alert(data.error || "Error");
    }
  }

  async function reject(id: string) {
    if (!confirm("¿Seguro que quieres rechazar este retiro? Los puntos se devolverán al usuario.")) return;
    setProcessing(id);
    const res = await fetch("/api/admin/reject-withdrawal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withdrawalId: id }),
    });
    setProcessing(null);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setList((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, status: "rejected" } : w
        )
      );
      if (data.newBalance != null) {
          window.dispatchEvent(new CustomEvent("freeboli-balance-update", { detail: data.newBalance }));
      }
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al rechazar");
    }
  }

  if (loading) return <div className="text-slate-400">Cargando…</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold text-white">Gestión de Retiros</h2>
      </div>

      <AdminWithdrawSettings />

      <div className="admin-table-container p-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Solicitudes Pendientes</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th>ID</th>
              <th>Usuario</th>
              <th>Puntos</th>
              <th>Wallet</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {list.map((w) => (
              <tr key={w.id} className="border-t border-slate-700">
                <td className="font-mono text-xs">{w.id.slice(0, 8)}…</td>
                <td className="font-mono text-xs">{w.user_id.slice(0, 8)}…</td>
                <td>{Number(w.points).toLocaleString()}</td>
                <td className="font-mono text-xs truncate max-w-[140px]">{w.wallet_destination}</td>
                <td>{w.status}</td>
                <td>
                  {w.status === "pending" && (
                    <div className="flex gap-2">
                        <button
                          onClick={() => process(w.id)}
                          disabled={!!processing}
                          className="btn-primary text-sm whitespace-nowrap"
                        >
                          {processing === w.id ? "..." : "Procesar"}
                        </button>
                        <button
                          onClick={() => reject(w.id)}
                          disabled={!!processing}
                          className="bg-red-500/20 hover:bg-red-500/40 text-red-400 px-3 py-1.5 rounded-lg text-sm border border-red-500/50 transition-colors whitespace-nowrap"
                        >
                          Rechazar
                        </button>
                    </div>
                  )}
                  {w.status === "completed" && w.tx_signature && (
                    <a
                      href={`https://solscan.io/tx/${w.tx_signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:underline"
                    >
                      Ver TX
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-4 text-slate-500">No hay retiros.</p>}
      </div>
    </div>
  );
}
