"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // Evitamos enumeración: siempre mostramos el mismo mensaje
      if (res.ok) {
        setMessage("Si el correo existe, te enviaremos un enlace para restablecer tu contraseña.");
      } else {
        setMessage("Si el correo existe, te enviaremos un enlace para restablecer tu contraseña.");
      }
    } catch {
      setMessage("No se pudo conectar. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-2xl font-bold text-white">Olvidé mi contraseña</h1>
      <p className="text-sm text-slate-400">
        Ingresa tu correo. Te enviaremos un enlace para restablecerla.
      </p>

      {message && (
        <div className="card border border-slate-700/80 bg-slate-800/30 p-3 text-sm text-slate-200">
          {message}
        </div>
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
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Enviando…" : "Enviar enlace"}
        </button>
      </form>

      <p className="text-center text-slate-400">
        ¿Volver a iniciar sesión?{" "}
        <Link href="/auth/login" className="text-amber-400 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

