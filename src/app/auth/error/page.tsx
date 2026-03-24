"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLang } from "@/context/LangContext";

function ErrorContent() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Unknown";
  const isNoSecret = error === "Configuration" || error.toLowerCase().includes("secret");

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-2xl font-bold text-red-400">{t("auth.auth_error_title")}</h1>
      <div className="card">
        <p className="text-slate-300">
          {t("auth.auth_error_code")} <strong className="font-mono">{error}</strong>
        </p>
        {isNoSecret && (
          <div className="mt-4 rounded-lg bg-amber-500/20 p-4 text-amber-200">
            <p className="font-semibold">{t("auth.auth_error_solution_title")}</p>
            <p className="mt-2 text-sm">
              {t("auth.auth_error_solution_p1")}{" "}
              <code className="rounded bg-slate-700 px-1">.env.local</code>:
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-800 p-3 text-xs whitespace-pre-wrap">
              {t("auth.auth_error_pre")}
            </pre>
            <p className="mt-2 text-sm">
              {t("auth.auth_error_solution_p2")}{" "}
              <code className="rounded bg-slate-700 px-1">{t("auth.auth_error_openssl")}</code>
            </p>
          </div>
        )}
      </div>
      <p className="text-slate-500 text-sm">{t("auth.auth_error_local_hint")}</p>
      <div className="flex flex-wrap gap-4">
        <Link href="/" className="btn-primary">
          {t("auth.auth_error_btn_home")}
        </Link>
        <Link href="/auth/login" className="btn-secondary">
          {t("auth.auth_error_btn_login")}
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  const { t } = useLang();
  return (
    <Suspense fallback={<div className="py-12 text-slate-400">{t("common.loading")}</div>}>
      <ErrorContent />
    </Suspense>
  );
}
