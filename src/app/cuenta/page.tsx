"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { POINTS_PER_BOLIS } from "@/lib/config";
import { SupportModal } from "@/components/SupportModal";
import { APP_VERSION } from "@/lib/version";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export default function CuentaPage() {
  const { data: session, status } = useSession();
  const [localUser, setLocalUser] = useState<{ id?: string } | null>(null);
  const [me, setMe] = useState<{
    user?: { id: string; publicId?: number | null; referralCode?: string | null };
    stats?: { emailVerified?: boolean };
  } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [movements, setMovements] = useState<{ id: string; type: string; points: number; reference: string | null; created_at: string }[]>([]);
  const [supportOpen, setSupportOpen] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [personal, setPersonal] = useState<null | {
    hiLoBets: number;
    faucetEarned: number;
    commissionsEarned: number;
    rankingPrizes: number;
    hiLoPrizes: number;
    rewardsEarned: number;
    paymentsTotal: number;
    depositsTotal: number;
    withdrawalsTotal: number;
    predictionPrizes: number;
  }>(null);

  useEffect(() => {
    if (!REQUIRE_AUTH) {
      fetch("/api/me").then((r) => r.json()).then((d) => setLocalUser(d.user ?? null)).catch(() => setLocalUser(null));
    }
  }, []);

  useEffect(() => {
    if (REQUIRE_AUTH && !session?.user) return;
    if (!REQUIRE_AUTH && !session?.user && !localUser) return;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d))
      .catch(() => setMe(null));
    fetch("/api/cuenta/personal-stats")
      .then((r) => r.json())
      .then((d) => setPersonal(d.stats ?? null))
      .catch(() => setPersonal(null));
  }, [session?.user, localUser]);
  useEffect(() => {
    if (REQUIRE_AUTH && !session?.user) return;
    if (!REQUIRE_AUTH && !session?.user && !localUser) return;
    fetch("/api/faucet")
      .then((r) => r.json())
      .then((d) => setBalance(d.points ?? 0))
      .catch(() => setBalance(0));
  }, [session?.user, localUser]);

  useEffect(() => {
    if (REQUIRE_AUTH && !session?.user) return;
    if (!REQUIRE_AUTH && !session?.user && !localUser) return;
    setMovementsLoading(true);
    fetch("/api/cuenta/movements")
      .then((r) => r.json())
      .then((d) => setMovements(d.movements ?? []))
      .catch(() => setMovements([]))
      .finally(() => setMovementsLoading(false));
  }, [session?.user, localUser]);

  if (REQUIRE_AUTH && status === "loading") return <div className="py-12 text-slate-400">Cargando…</div>;
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">Entra para ver tu cuenta.</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">Entrar</Link>
      </div>
    );
  }
  const userId = (session?.user as { id?: string } | undefined)?.id ?? localUser?.id;
  const referralCode = me?.user?.referralCode || me?.user?.publicId?.toString() || userId || "";
  const emailVerified = me?.stats?.emailVerified ?? true;

  async function resendVerification() {
    setVerifyMsg("");
    setVerifyLoading(true);
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setVerifyLoading(false);
    if (!res.ok) {
      setVerifyMsg(data.error || "No se pudo enviar el correo.");
      return;
    }
    setVerifyMsg(data.alreadyVerified ? "Tu correo ya está verificado." : "Listo. Te enviamos un correo con el enlace de verificación.");
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      <h1 className="text-2xl font-bold text-white">Mi cuenta</h1>

      {/* Email verification */}
      {!emailVerified && (
        <div id="verificacion" className="card space-y-3 border border-red-500/30 bg-red-500/10">
          <h2 className="text-lg font-semibold text-red-300">Verificación de correo</h2>
          <p className="text-sm text-slate-300">
            Para reclamar el Faucet y algunos bonus necesitas verificar tu correo.
          </p>
          {verifyMsg && (
            <div className={`rounded p-2 text-sm ${verifyMsg.startsWith("Listo") ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
              {verifyMsg}
            </div>
          )}
          <button
            onClick={resendVerification}
            disabled={verifyLoading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {verifyLoading ? "Enviando..." : "Reenviar verificación"}
          </button>
          <p className="text-xs text-slate-400">Revisa spam/promociones. El enlace expira en 1 hora.</p>
        </div>
      )}

      {/* Personal stats */}
      {personal && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-slate-300">Estadísticas personales</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Tiradas HI-LO</div>
              <div className="text-xl font-bold text-white">{personal.hiLoBets.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Ganancias Faucet</div>
              <div className="text-xl font-bold text-amber-400">{personal.faucetEarned.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Comisiones referidos</div>
              <div className="text-xl font-bold text-green-400">{personal.commissionsEarned.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Premios (ranking)</div>
              <div className="text-xl font-bold text-purple-400">{personal.rankingPrizes.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Premios (HI-LO)</div>
              <div className="text-xl font-bold text-blue-300">{personal.hiLoPrizes.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Premios (predicción)</div>
              <div className="text-xl font-bold text-amber-500">{personal.predictionPrizes.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Bonus / recompensas</div>
              <div className="text-xl font-bold text-white">{personal.rewardsEarned.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Depósitos totales</div>
              <div className="text-xl font-bold text-white">{personal.depositsTotal.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <div className="text-xs text-slate-400">Pagos totales</div>
              <div className="text-xl font-bold text-white">{personal.paymentsTotal.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-300">Balance</h2>
        <p className="text-3xl font-bold text-amber-400">
          {balance != null ? balance.toLocaleString() : "—"} puntos
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {String(POINTS_PER_BOLIS)} puntos = 1 BOLIS (retirable cuando alcances el mínimo)
        </p>
      </div>
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-300">Enlace de afiliado</h2>
        <p className="mt-1 text-sm text-slate-400">
          Comparte este enlace: quien se registre con él te dará comisión de por vida.
        </p>
        {typeof window !== "undefined" && referralCode && (
          <p className="mt-2 break-all rounded bg-slate-800 p-2 font-mono text-sm text-amber-400">
            {window.location.origin}/auth/registro?ref={referralCode}
          </p>
        )}
      </div>
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-300">Historial de depósitos y retiros</h2>
        {movementsLoading ? (
          <p className="text-slate-500 text-sm">Cargando…</p>
        ) : movements.length === 0 ? (
          <p className="text-slate-500 text-sm">Aún no hay depósitos ni retiros.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <div className="max-h-[220px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2 text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-slate-700/50">
                      <td className="p-2 text-slate-300">{new Date(m.created_at).toLocaleString()}</td>
                      <td className="p-2">
                        {m.type === "deposito_bolis" ? (
                          <span className="text-green-400">Depósito</span>
                        ) : (
                          <span className="text-amber-400">Retiro</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {m.type === "deposito_bolis" ? "+" : "-"}
                        {Number(m.points).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => setSupportOpen(true)}
        className="text-[10px] text-slate-600 hover:text-slate-500 transition mt-8 block mx-auto tracking-normal"
      >
        ¿Problemas con depósitos o retiros? Reportar error o disputa aquí - version {APP_VERSION}
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
