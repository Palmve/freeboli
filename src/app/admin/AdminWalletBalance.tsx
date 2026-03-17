"use client";

import { useEffect, useState } from "react";

export default function AdminWalletBalance() {
  const [data, setData] = useState<{
    address: string | null;
    sol: number;
    bolis: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/wallet-balance")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ address: null, sol: 0, bolis: 0, error: "Error al cargar" }));
  }, []);

  if (!data) return <div className="card text-slate-400">Cargando wallet…</div>;
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-300">Wallet del sitio (Solana)</h2>
      {data.error ? (
        <p className="mt-2 text-sm text-amber-400">{data.error}</p>
      ) : (
        <>
          <p className="mt-2 font-mono text-xs text-slate-400 break-all">{data.address}</p>
          <p className="mt-2 text-white">
            SOL: <strong>{data.sol.toFixed(4)}</strong>
          </p>
          <p className="text-white">
            BOLIS: <strong>{data.bolis.toFixed(4)}</strong>
          </p>
        </>
      )}
    </div>
  );
}
