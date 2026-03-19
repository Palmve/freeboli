"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

interface FaucetData {
  points: number;
  nextClaimIn: number | null;
  faucetPoints: number;
  pointsPerBolis: number;
  cooldownHours: number;
  hourlyStreak: number;
  dailyStreak: number;
  nextPayout: number;
  hourlyMultiplier: number;
  dailyBonus: number;
  needsCaptcha: boolean;
  captchaInterval: number;
  claimsSinceCaptcha: number;
  needsEngagement: boolean;
  engagementEvery: number;
  emailVerified: boolean;
}

interface CaptchaInfo {
  question: string;
  token: string;
  position: "top" | "bottom";
}

const HOURLY_TABLE = [
  { range: "1 – 3", mult: "x1.0", pts: 100 },
  { range: "4 – 6", mult: "x1.5", pts: 150 },
  { range: "7 – 12", mult: "x2.0", pts: 200 },
  { range: "13 – 24", mult: "x2.5", pts: 250 },
  { range: "25+", mult: "x3.0", pts: 300 },
];

const DAILY_TABLE = [
  { range: "1", bonus: "+0%" },
  { range: "2 – 3", bonus: "+10%" },
  { range: "4 – 7", bonus: "+25%" },
  { range: "8 – 14", bonus: "+50%" },
  { range: "15 – 30", bonus: "+75%" },
  { range: "30+", bonus: "+100%" },
];

export default function FaucetPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<FaucetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaInfo | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaError, setCaptchaError] = useState("");

  const fetchFaucet = useCallback(() => {
    fetch("/api/faucet")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    if (session?.user || !REQUIRE_AUTH) fetchFaucet();
    const t = setInterval(fetchFaucet, 10000);
    return () => clearInterval(t);
  }, [session?.user, fetchFaucet]);

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
    setCaptchaError("");
    setLoading(true);

    const body: Record<string, unknown> = {};
    if (captcha) {
      body.captchaAnswer = Number(captchaAnswer);
      body.captchaToken = captcha.token;
    }

    const res = await fetch("/api/faucet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (json.requireEmailVerification) {
      setError(json.error || "Verifica tu correo para reclamar.");
      fetchFaucet();
      return;
    }

    if (json.requireCaptcha) {
      setCaptcha(json.captcha);
      if (json.captchaError) setCaptchaError(json.captchaError);
      setCaptchaAnswer("");
      return;
    }

    if (json.requireEngagement) {
      setError(json.error || "Juega al menos 1 partida de HI-LO para seguir reclamando.");
      return;
    }

    if (!res.ok) {
      setError(json.error || "Error al reclamar.");
      if (json.waitSeconds) setData((d) => (d ? { ...d, nextClaimIn: json.waitSeconds } : null));
      return;
    }

    setCaptcha(null);
    setCaptchaAnswer("");
    fetchFaucet();
  }

  if (REQUIRE_AUTH && status === "loading") {
    return <div className="py-12 text-center text-slate-400">Cargando...</div>;
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

  const captchaUI = captcha && (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-400">Resuelve para continuar:</p>
      <p className="text-2xl font-bold text-white text-center">{captcha.question}</p>
      {captchaError && (
        <p className="text-sm text-red-400">{captchaError}</p>
      )}
      <input
        type="number"
        value={captchaAnswer}
        onChange={(e) => setCaptchaAnswer(e.target.value)}
        placeholder="Tu respuesta"
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white text-center text-lg"
        onKeyDown={(e) => e.key === "Enter" && claim()}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <h1 className="text-2xl font-bold text-white">Faucet</h1>

      <div className="card space-y-4">
        <p className="text-slate-300">
          Reclama hasta <strong className="text-amber-400">{data?.nextPayout ?? data?.faucetPoints ?? 0} puntos</strong>{" "}
          cada {data?.cooldownHours ?? 1} hora(s).
        </p>
        <p className="text-2xl font-bold text-white">
          Balance: {(data?.points ?? 0).toLocaleString()} puntos
        </p>
        <p className="text-sm text-slate-500">
          {data?.pointsPerBolis != null && `${String(data.pointsPerBolis)} puntos = 1 BOLIS`}
        </p>

        {/* Streak indicators */}
        {data && (data.hourlyStreak > 0 || data.dailyStreak > 0) && (
          <div className="flex gap-4 text-sm">
            <div className="flex-1 rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-slate-400">Racha horas</p>
              <p className="text-xl font-bold text-amber-400">{data.hourlyStreak}</p>
              <p className="text-xs text-slate-500">x{data.hourlyMultiplier}</p>
            </div>
            <div className="flex-1 rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-slate-400">Racha días</p>
              <p className="text-xl font-bold text-green-400">{data.dailyStreak}</p>
              <p className="text-xs text-slate-500">+{Math.round(data.dailyBonus * 100)}%</p>
            </div>
          </div>
        )}

        {/* Email verification required */}
        {data && data.emailVerified === false && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-2">
            <p className="text-sm font-medium text-red-400">
              Verifica tu correo electrónico para poder reclamar
            </p>
            <p className="text-xs text-slate-400">
              Revisa tu bandeja de entrada (y spam). Si no lo has recibido, ve a tu cuenta para reenviar la verificación.
            </p>
            <Link href="/cuenta#verificacion" className="btn-secondary text-sm inline-block">
              Ir a Mi cuenta
            </Link>
          </div>
        )}

        {/* Engagement warning */}
        {data?.needsEngagement && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 space-y-2">
            <p className="text-sm font-medium text-orange-400">
              Juega al menos 1 partida de HI-LO para seguir reclamando
            </p>
            <p className="text-xs text-slate-400">
              Cada {data.engagementEvery} reclamos se requiere actividad en los juegos (últimas 24h).
            </p>
            <Link href="/hi-lo" className="btn-secondary text-sm inline-block">
              Ir a HI-LO
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded bg-red-500/20 p-2 text-sm text-red-300">{error}</div>
        )}

        {captcha?.position === "top" && captchaUI}

        <button
          onClick={claim}
          disabled={loading || (!canClaim && !captcha)}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading
            ? "Reclamando..."
            : captcha
              ? "Enviar respuesta y reclamar"
              : canClaim
                ? "Reclamar ahora"
                : `Espera ${formatWait(data?.nextClaimIn ?? 0)}`}
        </button>

        {captcha?.position === "bottom" && captchaUI}
      </div>

      {/* Streak tables */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-amber-400">Bonificación por rachas</h2>
        <p className="text-sm text-slate-400">
          Reclama sin interrupciones para ganar más puntos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Reclamos consecutivos (horas)</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="py-1 text-left">Reclamos</th>
                  <th className="py-1 text-center">Mult.</th>
                  <th className="py-1 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {HOURLY_TABLE.map((row) => (
                  <tr key={row.range} className="border-b border-slate-700/50">
                    <td className="py-1 text-slate-300">{row.range}</td>
                    <td className="py-1 text-center text-amber-400">{row.mult}</td>
                    <td className="py-1 text-right text-white">{row.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Días seguidos</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="py-1 text-left">Días</th>
                  <th className="py-1 text-right">Bonus</th>
                </tr>
              </thead>
              <tbody>
                {DAILY_TABLE.map((row) => (
                  <tr key={row.range} className="border-b border-slate-700/50">
                    <td className="py-1 text-slate-300">{row.range}</td>
                    <td className="py-1 text-right text-green-400">{row.bonus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Fórmula: base x multiplicador hora x (1 + bonus día). Ejemplo: racha 25h + día 15 = 100 x 3.0 x 1.75 = 525 pts
        </p>
      </div>

      <p className="text-center text-slate-500 text-sm">
        <Link href="/cuenta" className="text-amber-400 hover:underline">
          Ver cuenta y retirar BOLIS
        </Link>
      </p>
    </div>
  );
}
