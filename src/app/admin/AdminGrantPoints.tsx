"use client";

import { useState } from "react";

export default function AdminGrantPoints() {
  const [email, setEmail] = useState("");
  const [points, setPoints] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const num = Math.floor(Number(points));
    if (!email.trim() || num < 1) {
      setError("Indica email y puntos (número positivo).");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/grant-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), points: num }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Error al otorgar.");
      return;
    }
    setMessage(`Otorgados ${data.pointsGranted} puntos a ${data.email}. Nuevo balance: ${data.newBalance}`);
    setEmail("");
    setPoints("");
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-300">Otorgar puntos a usuario</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="block text-sm text-slate-400">Email del usuario</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            placeholder="usuario@ejemplo.com"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Puntos a otorgar</label>
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            placeholder="100"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-green-400">{message}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enviando…" : "Otorgar puntos"}
        </button>
      </form>
    </div>
  );
}
