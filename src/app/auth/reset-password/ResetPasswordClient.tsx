"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/context/LangContext";

export default function ResetPasswordClient({ token }: { token: string }) {
  const { t } = useLang();
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
      setError(t("auth.error_token_invalid"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("auth.error_password_short"));
      return;
    }
    if (newPassword !== confirm) {
      setError(t("auth.error_password_mismatch"));
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
        setError(data.error || t("auth.error_reset_failed"));
        return;
      }

      setMessage(t("auth.reset_success"));
      setNewPassword("");
      setConfirm("");

      setTimeout(() => {
        router.push("/auth/login");
      }, 1500);
    } catch {
      setError(t("auth.error_connection"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-2xl font-bold text-white">{t("auth.reset_title")}</h1>

      {!token && (
        <div className="card border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {t("auth.error_no_token")}
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
          <label className="block text-sm text-slate-400">{t("auth.reset_new_password")}</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">{t("auth.reset_confirm")}</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading || !token}>
          {loading ? t("auth.reset_updating") : t("auth.reset_btn")}
        </button>
      </form>

      <p className="text-center text-slate-400">
        {t("auth.reset_have_login")}{" "}
        <Link href="/auth/login" className="text-amber-400 hover:underline">
          {t("auth.btn_login")}
        </Link>
      </p>
    </div>
  );
}
