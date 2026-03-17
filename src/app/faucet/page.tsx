"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export default function FaucetPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<{
    points: number;
    nextClaimIn: number | null;
    faucetPoints: number;
    pointsPerBolis: number;
    cooldownHours?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function fetchFaucet() {
    fetch("/api/faucet")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }

  useEffect(() => {
    if (session?.user || !REQUIRE_AUTH) fetchFaucet();
    const t = setInterval(fetchFaucet, 5000);
    return () => clearInterval(t);
  }, [session?.user]);

  useEffect(() => {
    if (!data?.nextClaimIn) return;
    const t = setInterval(() => {
      setData((d) =>
        d && d.nextClaimIn != null && d.nextClaimIn > 0
          ? { ...d, nextClaimIn: d.nextClaimIn - 1 }
          : d
      );
    }, 1000);
    return () => clearInterval(t);
  }, [data?.nextClaimIn]);

  async function claim() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/faucet", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "Error al reclamar.");
      if (json.waitSeconds) setData((d) => (d ? { ...d, nextClaimIn: json.waitSeconds } : null));
      return;
    }
    fetchFaucet();
  }

  if (REQUIRE_AUTH && status === "loading") {
    return <div className="py-12 text-center text-slate-400">Cargando…</div>;
  }
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">Entra o regístrate para usar el faucet.</p>
        <div className="mt-4 flex justify-center gap-4">
          <Link href="/auth/login" className="btn-primary">Entrar</Link>
          <Link href="/auth/registro" className="btn-secondary">Registrarse</Link>
        </div>
      </div>
    );
  }

  const canClaim = data?.nextClaimIn == null || data.nextClaimIn <= 0;
  const formatWait = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <h1 className="text-2xl font-bold text-white">Faucet</h1>
      <div className="card space-y-4">
        <p className="text-slate-300">
          Reclama <strong className="text-amber-400">{data?.faucetPoints ?? 0} puntos</strong> cada{" "}
          {data?.cooldownHours ?? 1} hora(s).
        </p>
        <p className="text-2xl font-bold text-white">
          Balance: {(data?.points ?? 0).toLocaleString()} puntos
        </p>
        <p className="text-sm text-slate-500">
          {data?.pointsPerBolis != null &&
            `${data.pointsPerBolis.toLocaleString()} puntos = 1 BOLIS`}
        </p>
        {error && (
          <div className="rounded bg-red-500/20 p-2 text-sm text-red-300">
            {error}
          </div>
        )}
        <button
          onClick={claim}
          disabled={loading || !canClaim}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading
            ? "Reclamando…"
            : canClaim
              ? "Reclamar ahora"
              : `Espera ${formatWait(data?.nextClaimIn ?? 0)}`}
        </button>
      </div>
      <p className="text-center text-slate-500 text-sm">
        <Link href="/cuenta" className="text-amber-400 hover:underline">
          Ver cuenta y retirar BOLIS
        </Link>
      </p>
    </div>
  );
}
