"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export default function DepositarPage() {
  const { data: session, status } = useSession();
  const [localOk, setLocalOk] = useState(false);
  useEffect(() => {
    if (!REQUIRE_AUTH) fetch("/api/me", { credentials: "include" }).then((r) => r.json()).then((d) => setLocalOk(!!d.user)).catch(() => setLocalOk(false));
  }, []);
  const [info, setInfo] = useState<{
    address: string;
    pointsPerBolis: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/deposit/address", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (d.address ? setInfo(d) : setInfo(null)))
      .catch(() => setInfo(null));
  }, []);

  const minDepositBolis = Math.ceil(MIN_WITHDRAW_POINTS / POINTS_PER_BOLIS);

  if (REQUIRE_AUTH && status === "loading") return <div className="py-12 text-slate-400">Cargando…</div>;
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">Entra para depositar.</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">Entrar</Link>
      </div>
    );
  }
  if (!REQUIRE_AUTH && !localOk && !session) return <div className="py-12 text-slate-400">Cargando…</div>;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <h1 className="text-2xl font-bold text-white">Depositar BOLIS</h1>
      <div className="card space-y-4">
        <p className="text-slate-300">
          Tienes una <strong>dirección exclusiva</strong> para tus depósitos. Envía BOLIS (token en Solana) a esta dirección desde Phantom o cualquier wallet; los puntos se acreditarán automáticamente. No hace falta memo ni verificar firma.
        </p>
        <p className="text-sm text-amber-400">
          {info?.pointsPerBolis != null && `${info.pointsPerBolis.toLocaleString()} puntos = 1 BOLIS`}
        </p>
        <p className="text-sm text-slate-400">
          Para poder retirar, deposita al menos <strong>{String(minDepositBolis)} BOLIS</strong> (equivale a {String(MIN_WITHDRAW_POINTS)} puntos).
        </p>
        {info?.address ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Tu dirección de depósito (escanea el QR o copia la dirección):</p>
            <div className="inline-block rounded-lg bg-white p-2">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(info.address)}`}
                alt="QR dirección de depósito"
                width={200}
                height={200}
                className="rounded"
              />
            </div>
            <div className="rounded-lg bg-slate-800 p-4 font-mono text-sm break-all text-green-400">
              {info.address}
            </div>
          </div>
        ) : (
          <p className="text-red-400">No se pudo cargar tu dirección. Revisa que el servidor tenga configurado DEPOSIT_WALLET_ENCRYPTION_KEY.</p>
        )}
      </div>
      <Link href="/cuenta" className="text-amber-400 hover:underline">
        ← Volver a Mi cuenta
      </Link>
    </div>
  );
}
