"use client";

import { useState } from "react";
import type { UserRow, UserStatus } from "./page";

type Movement = {
  id: string;
  type: string;
  points: number;
  reference: string | null;
  created_at: string;
};

const STATUS_CONFIG: Record<UserStatus, { label: string; bg: string; text: string }> = {
  normal: { label: "Normal", bg: "bg-green-500/20", text: "text-green-400" },
  evaluar: { label: "A Evaluar", bg: "bg-yellow-500/20", text: "text-yellow-400" },
  suspendido: { label: "Suspendido", bg: "bg-orange-500/20", text: "text-orange-400" },
  bloqueado: { label: "Bloqueado", bg: "bg-red-500/20", text: "text-red-400" },
};

const STATUS_OPTIONS: UserStatus[] = ["normal", "evaluar", "suspendido", "bloqueado"];

export default function AdminUsuariosTable({ users }: { users: UserRow[] }) {
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [historyEmail, setHistoryEmail] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({});

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

  async function updateStatus(userId: string, newStatus: UserStatus) {
    setStatusUpdating(userId);
    try {
      await fetch("/api/admin/user-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      });
      setUserStatuses((prev) => ({ ...prev, [userId]: newStatus }));
    } catch {
      // silently fail
    } finally {
      setStatusUpdating(null);
    }
  }

  function getStatus(u: UserRow): UserStatus {
    return userStatuses[u.id] ?? u.status;
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {STATUS_OPTIONS.map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <span key={s} className={`rounded px-2 py-1 ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
          );
        })}
      </div>

      <div className="admin-table-container">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="p-2">Email</th>
              <th className="p-2 text-center">Nivel</th>
              <th className="p-2">Registro</th>
              <th className="p-2 text-right">Balance</th>
              <th className="p-2 text-center">Faucet</th>
              <th className="p-2 text-center">Jugadas</th>
              <th className="p-2 text-center">Refs</th>
              <th className="p-2 text-center">IP</th>
              <th className="p-2 text-center">Status</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const st = getStatus(u);
              const cfg = STATUS_CONFIG[st];
              return (
                <tr key={u.id} className="border-t border-slate-700 hover:bg-slate-800/50">
                  <td className="p-2 text-slate-300 text-xs">{u.email ?? "—"}</td>
                  <td className="p-2 text-center text-xs">
                    <span className={u.level.color} title={`${u.level.name} (Nv.${u.level.level})`}>
                      {u.level.icon}
                    </span>
                  </td>
                  <td className="p-2 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-right font-mono text-xs">{u.balance.toLocaleString()}</td>
                  <td className="p-2 text-center text-xs">{u.faucetClaims}</td>
                  <td className="p-2 text-center text-xs">
                    <span className={u.betCount > 0 ? "text-green-400" : "text-slate-500"}>
                      {u.betCount}
                    </span>
                  </td>
                  <td className="p-2 text-center text-xs">{u.referralCount}</td>
                  <td className="p-2 text-center text-xs">
                    <span className={u.sameIpUsers > 3 ? "text-red-400 font-bold" : "text-slate-400"}>
                      {u.sameIpUsers}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => setDetailUser(u)}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text} hover:opacity-80`}
                      disabled={statusUpdating === u.id}
                    >
                      {statusUpdating === u.id ? "..." : cfg.label}
                    </button>
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => openHistory(u.id, u.email ?? u.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                      title="Ver historial"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail / Status change modal */}
      {detailUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDetailUser(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-xl bg-slate-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 p-4">
              <h3 className="font-semibold text-white">{detailUser.email ?? detailUser.id}</h3>
              <button onClick={() => setDetailUser(null)} className="text-slate-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* User stats */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-400">Nivel</div>
                <div className={detailUser.level.color}>{detailUser.level.icon} {detailUser.level.name} (Nv.{detailUser.level.level})</div>
                <div className="text-slate-400">Días registrado</div>
                <div className="text-white">{detailUser.daysRegistered}</div>
                <div className="text-slate-400">Balance</div>
                <div className="text-white">{detailUser.balance.toLocaleString()} pts</div>
                <div className="text-slate-400">Depósitos</div>
                <div className="text-green-400">+{detailUser.totalDeposito.toLocaleString()}</div>
                <div className="text-slate-400">Retiros</div>
                <div className="text-amber-400">-{detailUser.totalRetiro.toLocaleString()}</div>
                <div className="text-slate-400">Reclamos faucet</div>
                <div className="text-white">{detailUser.faucetClaims}</div>
                <div className="text-slate-400">Apuestas HI-LO</div>
                <div className={detailUser.betCount > 0 ? "text-green-400" : "text-red-400"}>{detailUser.betCount}</div>
                <div className="text-slate-400">Referidos</div>
                <div className="text-white">{detailUser.referralCount}</div>
                <div className="text-slate-400">Cuentas misma IP</div>
                <div className={detailUser.sameIpUsers > 3 ? "text-red-400" : "text-white"}>{detailUser.sameIpUsers}</div>
                <div className="text-slate-400">Email verificado</div>
                <div className={detailUser.emailVerified ? "text-green-400" : "text-red-400"}>{detailUser.emailVerified ? "Si" : "No"}</div>
              </div>

              {/* Flags */}
              {detailUser.flags.length > 0 && (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
                  <p className="text-xs font-medium text-yellow-400 mb-1">Señales detectadas:</p>
                  <ul className="text-xs text-yellow-300 space-y-0.5">
                    {detailUser.flags.map((f, i) => (
                      <li key={i}>- {f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Status selector */}
              <div>
                <p className="text-sm font-medium text-slate-300 mb-2">Cambiar status:</p>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((s) => {
                    const c = STATUS_CONFIG[s];
                    const current = getStatus(detailUser);
                    return (
                      <button
                        key={s}
                        onClick={() => {
                          updateStatus(detailUser.id, s);
                          setDetailUser({ ...detailUser, status: s });
                        }}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition ${c.bg} ${c.text} ${
                          current === s ? "ring-2 ring-white/50" : "opacity-70 hover:opacity-100"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movement history modal */}
      {historyUserId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setHistoryUserId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-slate-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 p-4">
              <h3 className="font-semibold text-white">Historial — {historyEmail}</h3>
              <button onClick={() => setHistoryUserId(null)} className="text-slate-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {historyLoading ? (
                <p className="text-slate-500">Cargando...</p>
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
                          {m.type === "deposito_bolis" ? "+" : "-"}
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
