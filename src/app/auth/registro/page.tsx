"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function RegistroPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [referral, setReferral] = useState("");
  const [hp, setHp] = useState("");
  const [formTs] = useState(() => Date.now());
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferral(ref);
  }, []);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<{ question: string; token: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!termsAccepted) {
      setError("Debes aceptar los terminos y condiciones para registrarte.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        email, 
        password, 
        referrerCode: referral || undefined, 
        _hp: hp, 
        _ts: formTs,
        captchaAnswer,
        captchaToken: captcha?.token
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      if (data.requireCaptcha) {
        setCaptcha(data.captcha);
        setCaptchaAnswer("");
        setError(data.error || "Se requiere CAPTCHA.");
      } else {
        setError(data.error || "Error al registrar.");
      }
      return;
    }
    setMessage("Cuenta creada. Redirigiendo…");
    await signIn("credentials", { email, password, redirect: false });
    window.location.href = "/";
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
      {error && (
        <div className="rounded-lg bg-red-500/20 p-3 text-red-300">{error}</div>
      )}
      {message && (
        <div className="rounded-lg bg-green-500/20 p-3 text-green-300">{message}</div>
      )}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm text-slate-400">Correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Contraseña</label>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 pr-10 text-white"
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-white"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.06.165-2.084.475-3.052M9.88 9.88A3 3 0 0012 15a3 3 0 001.999-.758" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.73 5.08A9.956 9.956 0 0112 5c5.523 0 10 4.477 10 10 0 1.31-.265 2.564-.743 3.707" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1.5 12s4.5-8.5 10.5-8.5S22.5 12 22.5 12s-4.5 8.5-10.5 8.5S1.5 12 1.5 12z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400">Código de referido (opcional)</label>
          <input
            type="text"
            value={referral}
            onChange={(e) => setReferral(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
        {/* CAPTCHA */}
        {captcha && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <label className="block text-sm font-medium text-blue-300 mb-2">
              Verificación de Seguridad
            </label>
            <div className="flex items-center gap-4">
              <div className="bg-slate-800 px-4 py-2 rounded-lg font-mono text-xl text-white border border-slate-700">
                {captcha.question}
              </div>
              <input
                type="number"
                required
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                placeholder="?"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <p className="text-xs text-blue-400/70 mt-2">
              Resuelve esta operación para confirmar que eres humano.
            </p>
          </div>
        )}
        {/* Terms acceptance */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="terms"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 shrink-0"
          />
          <label htmlFor="terms" className="text-sm text-slate-400">
            He leido y acepto los{" "}
            <Link href="/terminos" target="_blank" className="text-amber-400 hover:underline">
              Terminos y Condiciones
            </Link>
            {" "}de juego. Confirmo que soy mayor de 18 anos.
          </label>
        </div>
        {/* Honeypot - invisible to real users, bots auto-fill it */}
        <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading || !termsAccepted}>
          {loading ? "Creando..." : "Registrarse"}
        </button>
      </form>
      {process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" && (
        <div className="card">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 py-2 font-medium hover:bg-slate-700"
          >
            Continuar con Google
          </button>
        </div>
      )}
      <p className="text-center text-slate-400">
        ¿Ya tienes cuenta?{" "}
        <Link href="/auth/login" className="text-amber-400 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
