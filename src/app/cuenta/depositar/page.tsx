"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";
import { SupportModal } from "@/components/SupportModal";

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
  const [copied, setCopied] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    fetch("/api/deposit/address", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (d.address ? setInfo(d) : setInfo(null)))
      .catch(() => setInfo(null));
  }, []);

  async function copyAddress() {
    if (!info?.address) return;
    try {
      await navigator.clipboard.writeText(info.address);
    } catch {
      // Fallback para navegadores sin clipboard API
      const ta = document.createElement("textarea");
      ta.value = info.address;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
              <div className="flex items-start justify-between gap-3">
                <span className="break-all">{info.address}</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="rounded-md bg-slate-700/60 hover:bg-slate-700 px-2 py-1.5 text-slate-200 transition flex-shrink-0"
                  aria-label="Copiar dirección"
                  title="Copiar dirección"
                >
                  {copied ? (
                    <span className="text-xs font-semibold text-emerald-300">Copiado</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14h8a2 2 0 002-2V10a2 2 0 00-2-2h-8a2 2 0 00-2 2v2a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-red-400">No se pudo cargar tu dirección. Revisa que el servidor tenga configurado DEPOSIT_WALLET_ENCRYPTION_KEY.</p>
        )}
      </div>
      <Link href="/cuenta" className="text-amber-400 hover:underline">
        ← Volver a Mi cuenta
      </Link>

      <button
        onClick={() => setSupportOpen(true)}
        className="text-[10px] text-slate-600 hover:text-slate-500 transition mt-8 block mx-auto tracking-normal"
      >
        ¿Problemas con tu depósito? Reportar incidencia aquí
      </button>

      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        defaultType="delay"
        userEmail={session?.user?.email ?? ""}
      />
    </div>
  );
}
