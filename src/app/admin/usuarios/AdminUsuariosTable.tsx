"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { UserRow, UserStatus } from "./page";

type Movement = {
  id: string;
  type: string;
  points: number;
  reference: string | null;
  created_at: string;
};

const STATUS_CONFIG: Record<UserStatus, { label: string; bg: string; text: string; description: string }> = {
  normal: { 
    label: "Normal", 
    bg: "bg-green-500/20", 
    text: "text-green-400",
    description: "Usuario activo. Puede jugar, reclamar faucet y retirar libremente."
  },
  evaluar: { 
    label: "A Evaluar", 
    bg: "bg-yellow-500/20", 
    text: "text-yellow-400",
    description: "Bajo observación. El sistema ha detectado patrones sospechosos para revisión."
  },
  suspendido: { 
    label: "Suspendido", 
    bg: "bg-orange-500/20", 
    text: "text-orange-400",
    description: "Bloqueo temporal. El usuario no puede realizar retiros ni jugar."
  },
  bloqueado: { 
    label: "Bloqueado", 
    bg: "bg-red-500/20", 
    text: "text-red-400",
    description: "Bloqueo permanente. El acceso está totalmente denegado por fraude."
  },
};

const STATUS_OPTIONS: UserStatus[] = ["normal", "evaluar", "suspendido", "bloqueado"];

type SortKey = "public_id" | "email" | "created_at" | "balance" | "faucetClaims" | "hiLoPlays" | "hiLoAmount" | "predPlays" | "predAmount" | "referralCount" | "referralEarnings" | "sameIpUsers" | "rankingPos";

export default function AdminUsuariosTable({ users, dbError }: { users: UserRow[], dbError?: string | null }) {
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [historyEmail, setHistoryEmail] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({});

  const [sortKey, setSortKey] = useState<SortKey>("public_id");
  const [sortDesc, setSortDesc] = useState(true);

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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      let valA: any = a[sortKey];
      let valB: any = b[sortKey];

      if (sortKey === "rankingPos") { // Null handling for rank
        valA = valA === null ? Infinity : valA;
        valB = valB === null ? Infinity : valB;
      }
      
      if (valA === valB) return 0;
      
      if (typeof valA === "string" && typeof valB === "string") {
        return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      return sortDesc ? (valA < valB ? 1 : -1) : (valA > valB ? 1 : -1);
    });
  }, [users, sortKey, sortDesc]);

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortKey !== colKey) return <span className="text-slate-600 opacity-50 ml-1 group-hover:opacity-100">▴</span>;
    return <span className="text-amber-400 ml-1">{sortDesc ? "▾" : "▴"}</span>;
  };

  const Th = ({ label, colKey, align = "text-center" }: { label: string, colKey: SortKey, align?: string }) => (
    <th className={`p-2 cursor-pointer select-none group hover:bg-slate-800/50 transition-colors ${align}`} onClick={() => handleSort(colKey)}>
      {label} <SortIcon colKey={colKey} />
    </th>
  );

  if (dbError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-xl text-red-500 text-center font-bold">
        ⚠️ {dbError}
        <p className="text-xs mt-2 font-normal opacity-80">Por favor, verifica la consola o la base de datos (Supabase).</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="card p-10 text-center text-slate-500 italic">
        No se encontraron usuarios registrados aún.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Leyenda */}
      <div className="flex flex-wrap gap-2 text-[10px] md:text-xs">
        {STATUS_OPTIONS.map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <span key={s} className={`rounded px-2 py-1 ${cfg.bg} ${cfg.text} font-bold`}>
              {cfg.label}
            </span>
          );
        })}
      </div>

      {/* VISTA ESCRITORIO (Tabla Ordenable) */}
      <div className="hidden md:block admin-table-container">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-700 bg-slate-800/30">
              <Th label="ID" colKey="public_id" align="text-left" />
              <Th label="Email" colKey="email" align="text-left" />
              <th className="p-2 text-center text-[10px] uppercase font-bold text-slate-500">Última IP</th>
              <Th label="Rank" colKey="rankingPos" />
              <Th label="Reg" colKey="created_at" align="text-left" />
              <Th label="Balance" colKey="balance" align="text-right" />
              <th className="p-2 text-center" title="Nivel del Usuario">Nv</th>
              <Th label="Fct" colKey="faucetClaims" />
              <Th label="Hi-Lo Pts" colKey="hiLoAmount" />
              <Th label="HL #C" colKey="hiLoPlays" />
              <Th label="Prd Pts" colKey="predAmount" />
              <Th label="Prd #C" colKey="predPlays" />
              <Th label="Refs" colKey="referralCount" />
              <Th label="Pts Refs" colKey="referralEarnings" />
              <Th label="IPs" colKey="sameIpUsers" />
              <th className="p-2 text-center">Status</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u) => {
              const st = getStatus(u);
              const cfg = STATUS_CONFIG[st];
              return (
                <tr key={u.id} className="border-t border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                  <td className="p-2">
                    <Link 
                      href={`/admin/usuarios/${u.id}`}
                      className="text-amber-400 text-xs font-bold font-mono hover:underline hover:text-amber-300 transition-colors"
                    >
                      {u.public_id || "—"}
                    </Link>
                  </td>
                  <td className="p-2 text-slate-300 text-xs truncate max-w-[120px]">{u.email ?? "—"}</td>
                  <td className="p-2 text-center text-[10px] text-slate-500 font-mono">{u.lastIp || "—"}</td>
                  <td className="p-2 text-center font-bold text-amber-500 text-xs">{u.rankingPos ?? "-"}º</td>
                  <td className="p-2 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-right font-mono text-xs text-white">{u.balance.toLocaleString()}</td>
                  <td className="p-2 text-center text-xs">
                    <span className={u.level.color} title={`${u.level.name} (Nv.${u.level.level})`}>{u.level.icon}</span>
                  </td>
                  <td className="p-2 text-center text-xs">{u.faucetClaims}</td>
                  <td className="p-2 text-center text-xs font-mono text-sky-400">{u.hiLoAmount.toLocaleString()}</td>
                  <td className="p-2 text-center text-xs text-slate-400">{u.hiLoPlays}</td>
                  <td className="p-2 text-center text-xs font-mono text-indigo-400">{u.predAmount.toLocaleString()}</td>
                  <td className="p-2 text-center text-xs text-slate-400">{u.predPlays}</td>
                  <td className="p-2 text-center text-xs text-slate-400">{u.referralCount}</td>
                  <td className="p-2 text-center text-xs text-green-400 font-mono">{u.referralEarnings.toLocaleString()}</td>
                  <td className="p-2 text-center text-xs">
                    <span className={u.sameIpUsers > 3 ? "text-red-400 font-bold" : "text-slate-400"}>{u.sameIpUsers}</span>
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => setDetailUser(u)}
                      className={`rounded px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${cfg.bg} ${cfg.text} hover:scale-105 active:scale-95 transition-transform`}
                      disabled={statusUpdating === u.id}
                    >
                      {statusUpdating === u.id ? "..." : cfg.label}
                    </button>
                  </td>
                  <td className="p-2">
                    <button type="button" onClick={() => openHistory(u.id, u.email ?? u.id)} className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" title="Ver historial">
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

      {/* VISTA MÓVIL (Tarjetas) */}
      <div className="md:hidden space-y-3">
        {/* Mobile Sorting Controls */}
        <div className="flex gap-2 mb-4 bg-slate-800 p-2 rounded-xl">
          <span className="text-xs text-slate-400 py-1.5 pl-2">Ordenar:</span>
          <select 
            value={sortKey} 
            onChange={(e) => { setSortKey(e.target.value as SortKey); setSortDesc(true); }}
            className="flex-1 rounded bg-slate-900 border border-slate-700 text-xs text-amber-500 font-bold px-2 py-1 outline-none appearance-none"
          >
            <option value="created_at">Fecha Reg</option>
            <option value="balance">Balance Global</option>
            <option value="rankingPos">Posición Ranking</option>
            <option value="referralEarnings">Ganancias Refs</option>
            <option value="hiLoAmount">Volumen HiLo</option>
            <option value="predAmount">Volumen Predic</option>
            <option value="faucetClaims">Faucet Claims</option>
            <option value="sameIpUsers">Red de IPs</option>
          </select>
          <button onClick={() => setSortDesc(!sortDesc)} className="bg-slate-900 border border-slate-700 px-3 rounded text-amber-500 hover:bg-slate-700 transition">
            {sortDesc ? "▼" : "▲"}
          </button>
        </div>

        {sortedUsers.map((u) => {
          const st = getStatus(u);
          const cfg = STATUS_CONFIG[st];
          return (
            <div key={u.id} className="rounded-xl p-3 border border-slate-700/50 bg-slate-800/40 relative shadow-lg">
              <div className="flex justify-between items-start border-b border-slate-700/50 pb-2 mb-2">
                <div>
                  <h3 className="text-sm font-bold text-white truncate max-w-[200px]">{u.email ?? "—"}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={u.level.color + " text-xs"} title={`${u.level.name}`}>{u.level.icon} Nv.{u.level.level}</span>
                    <span className="text-slate-400 text-[10px]">• Reg: {new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-amber-500 font-bold text-sm">{u.rankingPos ? `${u.rankingPos}º` : "-º"}</div>
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Balance:</span> <span className="text-white font-mono">{u.balance.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Faucet:</span> <span className="text-slate-300">{u.faucetClaims} clm</span></div>
                
                <div className="col-span-2 border-t border-slate-700/50 pt-1 mt-1 flex justify-between">
                  <span className="text-slate-500 font-bold text-[10px] uppercase">Casino Volumen</span>
                </div>
                
                <div className="flex justify-between items-center"><span className="text-slate-500">Hi-Lo Pts:</span> <span className="text-sky-400 font-mono">{u.hiLoAmount.toLocaleString()}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500">Hi-Lo Jgs:</span> <span className="text-slate-400">{u.hiLoPlays}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500">Pred Pts:</span> <span className="text-indigo-400 font-mono">{u.predAmount.toLocaleString()}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500">Pred Jgs:</span> <span className="text-slate-400">{u.predPlays}</span></div>

                <div className="col-span-2 flex justify-between pt-2 border-t border-slate-700/50">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setDetailUser(u)} className="text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded text-[10px] uppercase font-bold transition">Gestionar Perfil</button>
                    <button onClick={() => openHistory(u.id, u.email ?? u.id)} className="text-slate-400 bg-slate-700/50 hover:bg-slate-700 px-2 py-1 rounded text-[10px] uppercase font-bold transition">Ver Historial</button>
                  </div>
                  <div className="text-[10px] flex items-center gap-2">
                    <span className="text-slate-400" title="Referidos">👥 {u.referralCount}</span>
                    <span className={u.sameIpUsers > 3 ? "text-red-400 font-bold" : "text-slate-400"} title="IPs Clones">🌐 {u.sameIpUsers}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
            className="w-full max-w-md rounded-xl bg-slate-800 shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 p-4 shrink-0">
              <h3 className="font-semibold text-white truncate pr-4">{detailUser.email ?? detailUser.id}</h3>
              <button onClick={() => setDetailUser(null)} className="text-slate-400 hover:text-white p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-5 overflow-y-auto scrollbar-hide">
              {/* Status selector (Prioridad en móvil) */}
              <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
                <p className="text-sm font-bold text-amber-400 mb-3 uppercase tracking-wider">Cambiar Estado:</p>
                <div className="space-y-3">
                  {STATUS_OPTIONS.map((s) => {
                    const c = STATUS_CONFIG[s];
                    const current = getStatus(detailUser);
                    return (
                      <div key={s} className="space-y-1">
                        <button
                          onClick={() => {
                            updateStatus(detailUser.id, s);
                            setDetailUser({ ...detailUser, status: s });
                          }}
                          className={`w-full rounded-lg px-3 py-2 text-xs font-bold transition-all shadow-md active:scale-95 border-2 flex items-center justify-between ${
                            current === s 
                              ? "border-white bg-white/20 " + c.text 
                              : "border-transparent opacity-60 hover:opacity-100 " + c.bg + " " + c.text
                          }`}
                        >
                          <span>{c.label}</span>
                          {current === s && <span className="text-[10px]">ACTUAL</span>}
                        </button>
                        <p className="text-[10px] text-slate-500 px-1 italic">{c.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* User stats */}
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                <div className="text-slate-500 font-medium">Nivel Global</div>
                <div className={detailUser.level.color + " font-bold"}>{detailUser.level.icon} {detailUser.level.name} (Nv.{detailUser.level.level})</div>
                <div className="text-slate-500 font-medium">Ranking FreeBoli</div>
                <div className="text-amber-500 font-bold">{detailUser.rankingPos ? `#${detailUser.rankingPos}` : "Sin Ranking"}</div>
                <div className="text-slate-500 font-medium">Días registrado</div>
                <div className="text-white">{detailUser.daysRegistered} d</div>
                <div className="text-slate-500 font-medium">Balance Maestro</div>
                <div className="text-white font-mono">{detailUser.balance.toLocaleString()} pts</div>
                <div className="text-slate-500 font-medium">Depósitos Realizados</div>
                <div className="text-green-400 font-mono">+{detailUser.totalDeposito.toLocaleString()}</div>
                <div className="text-slate-500 font-medium">Retiros Ejecutados</div>
                <div className="text-amber-400 font-mono">-{detailUser.totalRetiro.toLocaleString()}</div>
                
                <div className="col-span-2 border-t border-slate-700/50 my-1 pb-1"></div>

                <div className="text-slate-500 font-medium">Faucet Reclamos</div>
                <div className="text-white">{detailUser.faucetClaims}</div>
                <div className="text-slate-500 font-medium">Hi-Lo (Jgs / Pts)</div>
                <div className={detailUser.hiLoPlays > 0 ? "text-sky-400" : "text-slate-500"}>{detailUser.hiLoPlays} / {detailUser.hiLoAmount.toLocaleString()}</div>
                <div className="text-slate-500 font-medium">Predic (Jgs / Pts)</div>
                <div className={detailUser.predPlays > 0 ? "text-indigo-400" : "text-slate-500"}>{detailUser.predPlays} / {detailUser.predAmount.toLocaleString()}</div>

                <div className="col-span-2 border-t border-slate-700/50 my-1 pb-1"></div>

                <div className="text-slate-500 font-medium">Afiliados Traídos</div>
                <div className="text-white">{detailUser.referralCount}</div>
                <div className="text-slate-500 font-medium">Ganancias Refs</div>
                <div className="text-green-400 font-mono">{detailUser.referralEarnings.toLocaleString()} pts</div>
                <div className="text-slate-500 font-medium">Última IP Conocida</div>
                <div className="text-white font-mono">{detailUser.lastIp || "—"}</div>
                <div className="text-slate-500 font-medium">Usuarios Misma IP</div>
                <div className={detailUser.sameIpUsers > 3 ? "text-red-400 font-bold" : "text-white"}>{detailUser.sameIpUsers}</div>
                <div className="text-slate-500 font-medium">Email Verificado</div>
                <div className={detailUser.emailVerified ? "text-green-400" : "text-red-400 font-bold"}>{detailUser.emailVerified ? "SÍ" : "NO"}</div>
              </div>

              {/* Flags */}
              {detailUser.flags.length > 0 && (
                <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3 shadow-inner">
                  <p className="text-xs font-bold text-yellow-400 mb-1 flex items-center gap-1">⚠️ BANDERAS DE ALERTA:</p>
                  <ul className="text-[10px] text-yellow-300 space-y-1">
                    {detailUser.flags.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
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
            className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl bg-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 p-4 bg-slate-900/50">
              <h3 className="font-semibold text-white truncate pr-4">Resumen Financiero: {historyEmail}</h3>
              <button onClick={() => setHistoryUserId(null)} className="text-slate-400 hover:text-white bg-slate-800 rounded p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4 scrollbar-hide">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                </div>
              ) : movements.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Sin operaciones Fiat o Criptográficas guardadas.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      <th className="pb-2 pr-2">Aprobación (UTC)</th>
                      <th className="pb-2 pr-2">Dirección</th>
                      <th className="pb-2 text-right">Volumen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 pr-2 text-slate-300 text-xs">{new Date(m.created_at).toLocaleString()}</td>
                        <td className="py-3 pr-2">
                          {m.type === "deposito_bolis" ? (
                            <span className="text-green-400 font-bold text-xs bg-green-400/10 px-2 py-1 rounded">INGRESADO</span>
                          ) : (
                            <span className="text-amber-400 font-bold text-xs bg-amber-400/10 px-2 py-1 rounded">EXTRAIDO</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-white text-xs">
                          {m.type === "deposito_bolis" ? <span className="text-green-400">+</span> : <span className="text-amber-400">-</span>}
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
