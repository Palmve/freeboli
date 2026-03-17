"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password: password || undefined,
        redirect: false,
      });
      if (res?.error) {
        setError("Correo o contraseña incorrectos. ¿Ejecutaste /api/seed-admin?");
        return;
      }
      if (res?.ok) {
        window.location.href = "/";
        return;
      }
      setError("No hubo respuesta. Revisa la consola del servidor (terminal).");
    } catch (err) {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-2xl font-bold text-white">Entrar</h1>
      {error && (
        <div className="rounded-lg bg-red-500/20 p-3 text-red-300">{error}</div>
      )}
      <form onSubmit={handleCredentials} className="card space-y-4">
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
          <label className="block text-sm text-slate-400">Contraseña (opcional si solo usas Google)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
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
        ¿No tienes cuenta?{" "}
        <Link href="/auth/registro" className="text-amber-400 hover:underline">
          Registrarse
        </Link>
      </p>
    </div>
  );
}
