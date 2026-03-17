"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function RegistroPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferral(ref);
  }, []);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, referrerCode: referral || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Error al registrar.");
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
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            minLength={6}
            required
          />
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
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creando…" : "Registrarse"}
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
