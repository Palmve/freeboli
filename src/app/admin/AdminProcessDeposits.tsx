"use client";

import { useState } from "react";

export default function AdminProcessDeposits() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    processed: number;
    signatures?: string[];
    errors?: string[];
    message?: string;
    users_scanned?: number;
    rpc_hint?: string;
    debug?: { deposit_address: string; ata: string; signatures_found: number; skip_reasons?: string[] }[];
  } | null>(null);
  const [error, setError] = useState("");

  async function processDeposits() {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/deposit/process-incoming", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError([data.error, data.detail].filter(Boolean).join(" — ") || "Error al procesar.");
        return;
      }
      setResult({
        processed: data.processed ?? 0,
        signatures: data.signatures,
        errors: data.errors,
        message: data.message,
        users_scanned: data.users_scanned,
        rpc_hint: data.rpc_hint,
        debug: data.debug,
      });
    } catch {
      setLoading(false);
      setError("Error de conexión.");
    }
  }

  return (
    <div className="card !p-4 sm:!p-6">
      <h2 className="text-lg font-semibold text-slate-300">Procesar depósitos BOLIS</h2>
      <p className="mt-1 text-sm text-slate-400">
        Revisa la dirección exclusiva de cada usuario en busca de BOLIS recibidos y acredita los puntos automáticamente (sin memo).
      </p>
      <button
        type="button"
        onClick={processDeposits}
        disabled={loading}
        className="btn-primary mt-4 disabled:opacity-50"
      >
        {loading ? "Procesando…" : "Procesar depósitos ahora"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
      {result && (
        <div className="mt-3 rounded-lg bg-slate-800 p-3 text-sm">
          <p className="text-green-400">
            Acreditados: <strong>{result.processed}</strong> depósito(s).
          </p>
          {result.users_scanned != null && (
            <p className="mt-1 text-slate-400 text-xs">
              Direcciones escaneadas: {result.users_scanned}.
            </p>
          )}
          {result.message && (
            <p className="mt-1 text-slate-400 text-xs">{result.message}</p>
          )}
          {result.signatures && result.signatures.length > 0 && (
            <p className="mt-1 font-mono text-xs text-slate-400">
              Tx: {result.signatures.join(", ")}
            </p>
          )}
          {result.errors && result.errors.length > 0 && (
            <p className="mt-1 text-amber-400 text-xs">{result.errors.join("; ")}</p>
          )}
          {result.rpc_hint && (
            <p className="mt-2 rounded bg-amber-900/40 border border-amber-600/50 px-2 py-1.5 text-amber-200 text-xs">
              💡 {result.rpc_hint}
            </p>
          )}
          {result.debug && result.debug.length > 0 && (
            <div className="mt-2 border-t border-slate-600 pt-2 text-xs text-slate-400">
              <p className="font-medium text-slate-300">Diagnóstico:</p>
              {result.debug.map((d, i) => (
                <div key={i} className="mt-1 font-mono">
                  <span title={d.deposit_address}>Wallet: …{d.deposit_address.slice(-8)}</span>
                  {" · "}
                  <span title={d.ata}>ATA: …{d.ata.slice(-8)}</span>
                  {" · "}
                  Firmas: {d.signatures_found}
                  {d.skip_reasons?.length ? (
                    <span className="block mt-0.5 text-amber-400">Motivos descarte: {d.skip_reasons.join("; ")}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
