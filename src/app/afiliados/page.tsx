"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SupportModal } from "@/components/SupportModal";
import { APP_VERSION } from "@/lib/version";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

interface Referral {
  referredId: string;
  email: string;
  date: string;
  verified: boolean;
  bets: number;
  daysRegistered: number;
  pointsGenerated: number;
  bonusEligible: boolean;
  bonusClaimed: boolean;
}

interface AffiliateData {
  referrals: Referral[];
  totalReferrals: number;
  totalVerified: number;
  totalCommissions: number;
  totalBonusPoints: number;
  commissionPercent: number;
  achievementPercent: number;
  verifiedBonus: number;
  minBets: number;
  minDays: number;
  userId: string;
  referralCode?: string | null;
}

function ShareButtons({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Gana puntos y BOLIS gratis en FreeBoli! Regístrate con mi enlace: ${url}`;
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const buttons = [
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}`,
      color: "bg-green-600 hover:bg-green-700",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
    },
    {
      name: "X / Twitter",
      href: `https://twitter.com/intent/tweet?text=${encodedText}`,
      color: "bg-slate-700 hover:bg-slate-600",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "bg-blue-600 hover:bg-blue-700",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
    },
    {
      name: "TikTok",
      href: "#",
      color: "bg-pink-600 hover:bg-pink-700",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      ),
      onClick: () => {
        navigator.clipboard.writeText(url);
        alert("Enlace copiado. Pégalo en TikTok para compartir.");
      },
    },
    {
      name: "Correo",
      href: `mailto:?subject=${encodeURIComponent("Gana puntos y BOLIS gratis en FreeBoli!")}&body=${encodedText}`,
      color: "bg-slate-600 hover:bg-slate-500",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
      ),
    },
    {
      name: copied ? "Copiado!" : "Copiar",
      href: "#",
      color: copied ? "bg-green-600" : "bg-amber-700 hover:bg-amber-600",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
      ),
      onClick: copyLink,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {buttons.map((btn) => (
        <a
          key={btn.name}
          href={btn.onClick ? "#" : btn.href}
          target={btn.href.startsWith("http") ? "_blank" : undefined}
          rel={btn.href.startsWith("http") ? "noopener noreferrer" : undefined}
          onClick={(e) => {
            if (btn.onClick) {
              e.preventDefault();
              btn.onClick();
            }
          }}
          className={`flex flex-col items-center gap-2 rounded-xl ${btn.color} p-3 text-white transition`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            {btn.icon}
          </div>
          <span className="text-xs">{btn.name}</span>
        </a>
      ))}
    </div>
  );
}

export default function AfiliadosPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");
  const [claimingBonus, setClaimingBonus] = useState<string | null>(null);
  const [bonusMsg, setBonusMsg] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (REQUIRE_AUTH && !session?.user) return;
    fetch("/api/affiliates")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.user]);

  async function claimBonus(referredId: string) {
    setClaimingBonus(referredId);
    setBonusMsg("");
    const res = await fetch("/api/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referredId }),
    });
    const json = await res.json().catch(() => ({}));
    setClaimingBonus(null);
    if (!res.ok) {
      setBonusMsg(json.error || "Error al reclamar bonus");
      return;
    }
    setBonusMsg(`+${json.points.toLocaleString()} puntos reclamados!`);
    setData((d) =>
      d
        ? {
            ...d,
            referrals: d.referrals.map((r) =>
              r.referredId === referredId ? { ...r, bonusClaimed: true, bonusEligible: false } : r
            ),
            totalBonusPoints: d.totalBonusPoints + json.points,
          }
        : d
    );
  }

  if (REQUIRE_AUTH && status === "loading") {
    return <div className="py-12 text-center text-slate-400">Cargando...</div>;
  }
  if (REQUIRE_AUTH && !session) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-slate-300">Inicia sesión para ver tu plan de afiliados.</p>
        <Link href="/auth/login" className="btn-primary mt-4 inline-block">Entrar</Link>
      </div>
    );
  }

  const referralUrl = data?.referralCode
    ? `${origin}/auth/registro?ref=${encodeURIComponent(data.referralCode)}`
    : data?.userId
      ? `${origin}/auth/registro?ref=${data.userId}`
      : "";

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <h1 className="text-2xl font-bold text-white">Plan de afiliados</h1>

      {/* Benefits */}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-amber-400">Gana invitando amigos</h2>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            <span>
              <strong>{data?.commissionPercent ?? 50}%</strong> de comisión permanente sobre los puntos que tus referidos ganen
              en el faucet y juegos.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            <span>
              <strong>{(data?.verifiedBonus ?? 10000).toLocaleString()} puntos</strong> de bonus por cada referido que:
              verifique su correo, juegue al menos <strong>{data?.minBets ?? 20}</strong> partidas de HI-LO,
              y lleve al menos <strong>{data?.minDays ?? 3}</strong> días registrado.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            <span>
              <strong>{data?.achievementPercent ?? 10}%</strong> de los logros que tus referidos reclamen.
            </span>
          </li>
        </ul>
      </div>

      {/* Referral link + share */}
      {loading ? (
        <div className="card text-center text-slate-400">Cargando...</div>
      ) : referralUrl ? (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-slate-300">Tu enlace de referido</h2>
          <div className="break-all rounded-lg bg-slate-800 p-3 font-mono text-sm text-amber-400 border border-slate-700">
            {referralUrl}
          </div>

          <h3 className="text-sm font-medium text-slate-300">Compartir</h3>
          <ShareButtons url={referralUrl} />
        </div>
      ) : (
        <div className="card">
          <p className="text-slate-400 text-sm">Inicia sesión para ver tu enlace de referido.</p>
        </div>
      )}

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card text-center p-3">
            <p className="text-2xl font-bold text-white">{data.totalReferrals}</p>
            <p className="text-xs text-slate-400">Referidos</p>
          </div>
          <div className="card text-center p-3">
            <p className="text-2xl font-bold text-green-400">{data.totalVerified}</p>
            <p className="text-xs text-slate-400">Verificados</p>
          </div>
          <div className="card text-center p-3">
            <p className="text-2xl font-bold text-amber-400">{data.totalCommissions.toLocaleString()}</p>
            <p className="text-xs text-slate-400">Comisiones</p>
          </div>
          <div className="card text-center p-3">
            <p className="text-2xl font-bold text-purple-400">{data.totalBonusPoints.toLocaleString()}</p>
            <p className="text-xs text-slate-400">Bonus verif.</p>
          </div>
        </div>
      )}

      {/* Referral list */}
      {data && data.referrals.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-slate-300">Tus referidos</h2>

          {bonusMsg && (
            <div className={`rounded p-2 text-sm ${bonusMsg.startsWith("+") ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
              {bonusMsg}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="p-2">Email</th>
                    <th className="p-2">Fecha</th>
                    <th className="p-2 text-center">Verif.</th>
                    <th className="p-2 text-center">Jugadas</th>
                    <th className="p-2 text-right">Comisión</th>
                    <th className="p-2 text-center">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((r) => (
                    <tr key={r.referredId} className="border-b border-slate-700/50">
                      <td className="p-2 text-slate-300 font-mono text-xs">{r.email}</td>
                      <td className="p-2 text-slate-400 text-xs">
                        {new Date(r.date).toLocaleDateString()}
                      </td>
                      <td className="p-2 text-center">
                        {r.verified ? (
                          <span className="text-green-400 text-xs">Si</span>
                        ) : (
                          <span className="text-slate-500 text-xs">No</span>
                        )}
                      </td>
                      <td className="p-2 text-center text-xs">
                        <span className={r.bets >= (data.minBets) ? "text-green-400" : "text-slate-400"}>
                          {r.bets}/{data.minBets}
                        </span>
                      </td>
                      <td className="p-2 text-right font-mono text-xs text-amber-400">
                        {r.pointsGenerated.toLocaleString()}
                      </td>
                      <td className="p-2 text-center">
                        {r.bonusClaimed ? (
                          <span className="text-green-400 text-xs">Cobrado</span>
                        ) : r.bonusEligible ? (
                          <button
                            onClick={() => claimBonus(r.referredId)}
                            disabled={claimingBonus === r.referredId}
                            className="rounded bg-amber-600 hover:bg-amber-500 px-2 py-0.5 text-xs text-white disabled:opacity-50"
                          >
                            {claimingBonus === r.referredId ? "..." : "Reclamar"}
                          </button>
                        ) : (
                          <span className="text-slate-500 text-xs" title={
                            !r.verified
                              ? "Falta verificar email"
                              : r.bets < (data.minBets)
                                ? `Faltan ${(data.minBets) - r.bets} jugadas`
                                : r.daysRegistered < (data.minDays)
                                  ? `Faltan ${(data.minDays) - r.daysRegistered} días`
                                  : "No elegible"
                          }>
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            El bonus de {data.verifiedBonus.toLocaleString()} pts se otorga cuando el referido verifica email,
            juega al menos {data.minBets} partidas y lleva {data.minDays}+ días registrado.
          </p>
        </div>
      )}

      <div className="flex justify-center gap-4 text-sm">
        <Link href="/recompensas" className="text-amber-400 hover:underline">Recompensas</Link>
        <Link href="/faucet" className="text-amber-400 hover:underline">Faucet</Link>
      </div>

      <button
        onClick={() => setSupportOpen(true)}
        className="text-[10px] text-slate-600 hover:text-slate-500 transition mt-8 block mx-auto tracking-normal"
      >
        ¿Problemas con tus referidos? Reportar incidencia aquí - version {APP_VERSION}
      </button>

      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        defaultType="other"
        userEmail={session?.user?.email ?? ""}
      />
    </div>
  );
}
