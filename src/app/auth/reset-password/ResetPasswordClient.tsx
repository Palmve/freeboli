"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordClient({ token }: { token: string }) {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!token) {
      setError("Token inválido.");
      return;
    }
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo restablecer la contraseña.");
        return;
      }

      setMessage("Contraseña actualizada. Ya puedes iniciar sesión.");
      setNewPassword("");
      setConfirm("");

      setTimeout(() => {
        router.push("/auth/login");
      }, 1500);
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-2xl font-bold text-white">Restablecer contraseña</h1>

      {!token && (
        <div className="card border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          No se recibió un token válido.
        </div>
      )}

      {message && (
        <div className="card border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
          {message}
        </div>
      )}
      {error && (
        <div className="card border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm text-slate-400">Nueva contraseña</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Confirmar contraseña</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading || !token}>
          {loading ? "Actualizando…" : "Actualizar contraseña"}
        </button>
      </form>

      <p className="text-center text-slate-400">
        ¿Ya la tienes?{" "}
        <Link href="/auth/login" className="text-amber-400 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

