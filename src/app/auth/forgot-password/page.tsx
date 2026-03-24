"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/context/LangContext";

export default function ForgotPasswordPage() {
  const { t } = useLang();
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

      if (res.ok) {
        setMessage(t("auth.forgot_message"));
      } else {
        setMessage(t("auth.forgot_message"));
      }
    } catch {
      setMessage(t("auth.forgot_error_connect"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-2xl font-bold text-white">{t("auth.forgot_title")}</h1>
      <p className="text-sm text-slate-400">{t("auth.forgot_desc")}</p>

      {message && (
        <div className="card border border-slate-700/80 bg-slate-800/30 p-3 text-sm text-slate-200">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm text-slate-400">{t("auth.email")}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? t("auth.btn_sending") : t("auth.btn_send_link")}
        </button>
      </form>

      <p className="text-center text-slate-400">
        {t("auth.back_to_login")}{" "}
        <Link href="/auth/login" className="text-amber-400 hover:underline">
          {t("auth.btn_login")}
        </Link>
      </p>
    </div>
  );
}
