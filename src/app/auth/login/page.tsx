"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/context/LangContext";

export default function LoginPage() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        setError(t("auth.error_credentials"));
        return;
      }
      if (res?.ok) {
        window.location.href = "/";
        return;
      }
      setError(t("auth.error_no_response"));
    } catch {
      setError(t("auth.error_connection"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-2xl font-bold text-white">{t("auth.login_title")}</h1>
      {error && (
        <div className="rounded-lg bg-red-500/20 p-3 text-red-300">{error}</div>
      )}
      <form onSubmit={handleCredentials} className="card space-y-4">
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
        <div>
          <label className="block text-sm text-slate-400">{t("auth.password_optional_google")}</label>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 pr-10 text-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-white"
              aria-label={showPassword ? t("auth.aria_hide_password") : t("auth.aria_show_password")}
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
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? t("auth.btn_login_loading") : t("auth.btn_login")}
        </button>
        <p className="text-center text-sm text-slate-500">
          <Link href="/auth/forgot-password" className="text-slate-400 hover:text-amber-400 hover:underline">
            {t("auth.forgot_password")}
          </Link>
        </p>
      </form>
      {process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" && (
        <div className="card">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 py-2 font-medium hover:bg-slate-700"
          >
            {t("auth.google_continue")}
          </button>
        </div>
      )}
      <p className="text-center text-slate-400">
        {t("auth.no_account")}{" "}
        <Link href="/auth/registro" className="text-amber-400 hover:underline">
          {t("auth.btn_register")}
        </Link>
      </p>
      <p className="text-center text-sm text-slate-500">
        <Link href="/terminos" className="text-slate-400 hover:text-amber-400 hover:underline">
          {t("auth.terms_footer_link")}
        </Link>
      </p>
    </div>
  );
}
