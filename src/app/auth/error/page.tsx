"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Unknown";
  const isNoSecret = error === "Configuration" || error.toLowerCase().includes("secret");

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-2xl font-bold text-red-400">Error de autenticación</h1>
      <div className="card">
        <p className="text-slate-300">
          Código: <strong className="font-mono">{error}</strong>
        </p>
        {isNoSecret && (
          <div className="mt-4 rounded-lg bg-amber-500/20 p-4 text-amber-200">
            <p className="font-semibold">Solución habitual:</p>
            <p className="mt-2 text-sm">
              Añade en <code className="rounded bg-slate-700 px-1">.env.local</code>:
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-800 p-3 text-xs">
              NEXTAUTH_URL=http://localhost:3000{"\n"}
              NEXTAUTH_SECRET=una-clave-secreta-de-al-menos-32-caracteres
            </pre>
            <p className="mt-2 text-sm">
              Genera una clave con: <code className="rounded bg-slate-700 px-1">openssl rand -base64 32</code>
            </p>
          </div>
        )}
      </div>
      <p className="text-slate-500 text-sm">
        Si usas <strong>modo local</strong> (REQUIRE_AUTH=false), no necesitas iniciar sesión: ve al inicio y usa Faucet / HI-LO directamente.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link href="/" className="btn-primary">
          Ir al inicio
        </Link>
        <Link href="/auth/login" className="btn-secondary">
          Volver a Entrar
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="py-12 text-slate-400">Cargando…</div>}>
      <ErrorContent />
    </Suspense>
  );
}
