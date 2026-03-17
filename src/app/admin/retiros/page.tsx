"use client";

import { useEffect, useState } from "react";

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

  if (loading) return <div className="text-slate-400">Cargando…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Retiros</h2>
      <div className="overflow-x-auto">
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
                    <button
                      onClick={() => process(w.id)}
                      disabled={!!processing}
                      className="btn-primary text-sm"
                    >
                      {processing === w.id ? "Enviando…" : "Procesar"}
                    </button>
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
