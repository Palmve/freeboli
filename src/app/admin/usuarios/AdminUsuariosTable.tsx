"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  balance: number;
  totalDeposito: number;
  totalRetiro: number;
};

type Movement = {
  id: string;
  type: string;
  points: number;
  reference: string | null;
  created_at: string;
};

export default function AdminUsuariosTable({ users }: { users: UserRow[] }) {
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [historyEmail, setHistoryEmail] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function openHistory(userId: string, email: string) {
    setHistoryUserId(userId);
    setHistoryEmail(email);
    setMovements([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/user-movements?userId=${encodeURIComponent(userId)}`);
      const data = await res.json().catch(() => ({}));
      setMovements(data.movements ?? []);
    } catch {
      setMovements([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="p-2">ID</th>
              <th className="p-2">Email</th>
              <th className="p-2">Nombre</th>
              <th className="p-2">Registro</th>
              <th className="p-2 text-right">BOLIS (pts)</th>
              <th className="p-2 text-right">Depósito</th>
              <th className="p-2 text-right">Retiro</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-700">
                <td className="p-2 font-mono text-xs">{u.id.slice(0, 8)}…</td>
                <td className="p-2">{u.email ?? "—"}</td>
                <td className="p-2">{u.name ?? "—"}</td>
                <td className="p-2 text-slate-400">{new Date(u.created_at).toLocaleString()}</td>
                <td className="p-2 text-right font-mono">{u.balance.toLocaleString()}</td>
                <td className="p-2 text-right font-mono text-green-400">+{u.totalDeposito.toLocaleString()}</td>
                <td className="p-2 text-right font-mono text-amber-400">−{u.totalRetiro.toLocaleString()}</td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => openHistory(u.id, u.email ?? u.id)}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
                    title="Ver historial de depósitos y retiros"
                    aria-label="Historial"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {historyUserId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setHistoryUserId(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Historial de operaciones"
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-slate-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 p-4">
              <h3 className="font-semibold text-white">Historial — {historyEmail}</h3>
              <button
                type="button"
                onClick={() => setHistoryUserId(null)}
                className="rounded p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                aria-label="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {historyLoading ? (
                <p className="text-slate-500">Cargando…</p>
              ) : movements.length === 0 ? (
                <p className="text-slate-500">Sin operaciones de depósito o retiro.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      <th className="pb-2 pr-2">Fecha</th>
                      <th className="pb-2 pr-2">Tipo</th>
                      <th className="pb-2 text-right">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-b border-slate-700/50">
                        <td className="py-2 pr-2 text-slate-300">{new Date(m.created_at).toLocaleString()}</td>
                        <td className="py-2 pr-2">
                          {m.type === "deposito_bolis" ? (
                            <span className="text-green-400">Depósito</span>
                          ) : (
                            <span className="text-amber-400">Retiro</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {m.type === "deposito_bolis" ? "+" : "−"}
                          {Number(m.points).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
