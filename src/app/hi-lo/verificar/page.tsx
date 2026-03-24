"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/context/LangContext";

async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function rollFromSeedsClient(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<number> {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`;
  const hashHex = await sha256Hex(combined);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 2) {
    bytes[i / 2] = parseInt(hashHex.slice(i, i + 2), 16);
  }
  const view = new DataView(bytes.buffer);
  const n = view.getUint32(0, false);
  return n % 10000;
}

function VerificarContent() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [hashMatches, setHashMatches] = useState<boolean | null>(null);
  const [roll, setRoll] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const run = useCallback(async () => {
    const server_seed = searchParams.get("server_seed");
    const server_seed_hash = searchParams.get("server_seed_hash");
    const client_seed = searchParams.get("client_seed");
    const nonce = searchParams.get("nonce");

    if (!server_seed || !server_seed_hash || !client_seed || nonce === null || nonce === "") {
      setErrorMsg(t("hilo_verify.error_params"));
      setStatus("error");
      return;
    }

    const nonceNum = parseInt(nonce, 10);
    if (!Number.isInteger(nonceNum) || nonceNum < 0) {
      setErrorMsg(t("hilo_verify.error_nonce"));
      setStatus("error");
      return;
    }

    try {
      const computedHash = await sha256Hex(server_seed);
      const matches = computedHash === server_seed_hash;
      setHashMatches(matches);
      const r = await rollFromSeedsClient(server_seed, client_seed, nonceNum);
      setRoll(r);
      setStatus("ok");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t("hilo_verify.error_verify"));
      setStatus("error");
    }
  }, [searchParams, t]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <h1 className="text-2xl font-bold text-white">{t("hilo_verify.title")}</h1>
      <p className="text-slate-400 text-sm">{t("hilo_verify.intro")}</p>

      {status === "loading" && <p className="text-slate-500">{t("hilo_verify.loading")}</p>}
      {status === "error" && (
        <div className="rounded-lg bg-red-500/20 p-4 text-red-300">{errorMsg}</div>
      )}
      {status === "ok" && (
        <div className="card space-y-4">
          {hashMatches ? (
            <p className="text-lg font-semibold text-green-400">{t("hilo_verify.hash_ok")}</p>
          ) : (
            <p className="text-lg font-semibold text-red-400">{t("hilo_verify.hash_bad")}</p>
          )}
          {roll !== null && (
            <div>
              <p className="text-slate-400 text-sm">{t("hilo_verify.roll_label")}</p>
              <p className="font-mono text-4xl font-bold text-white">{roll}</p>
            </div>
          )}
        </div>
      )}

      <Link href="/hi-lo" className="text-amber-400 hover:underline">
        {t("hilo_verify.back_hilo")}
      </Link>
    </div>
  );
}

function VerificarLoadingFallback() {
  const { t } = useLang();
  return <div className="mx-auto max-w-lg py-8 text-slate-500">{t("common.loading")}</div>;
}

export default function VerificarPage() {
  return (
    <Suspense fallback={<VerificarLoadingFallback />}>
      <VerificarContent />
    </Suspense>
  );
}
