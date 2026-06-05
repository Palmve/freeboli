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

  const [serverSeed, setServerSeed] = useState("");
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [clientSeed, setClientSeed] = useState("");
  const [nonce, setNonce] = useState("");

  const [hashMatches, setHashMatches] = useState<boolean | null>(null);
  const [roll, setRoll] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);

  const verify = useCallback(
    async (ss: string, ssh: string, cs: string, n: string) => {
      setErrorMsg("");
      setRoll(null);
      setHashMatches(null);
      setDone(false);

      if (!ss.trim() || !cs.trim() || n === "") {
        setErrorMsg(t("hilo_verify.error_params"));
        return;
      }
      const nonceNum = parseInt(n, 10);
      if (!Number.isInteger(nonceNum) || nonceNum < 0) {
        setErrorMsg(t("hilo_verify.error_nonce"));
        return;
      }

      try {
        if (ssh.trim()) {
          const computed = await sha256Hex(ss.trim());
          setHashMatches(computed === ssh.trim().toLowerCase());
        } else {
          setHashMatches(null);
        }
        const r = await rollFromSeedsClient(ss.trim(), cs.trim(), nonceNum);
        setRoll(r);
        setDone(true);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : t("hilo_verify.error_verify"));
      }
    },
    [t]
  );

  // Pre-rellenar desde la URL (enlace VER) y auto-verificar si vienen los datos.
  useEffect(() => {
    const ss = searchParams.get("server_seed") ?? "";
    const ssh = searchParams.get("server_seed_hash") ?? "";
    const cs = searchParams.get("client_seed") ?? "";
    const n = searchParams.get("nonce") ?? "";
    setServerSeed(ss);
    setServerSeedHash(ssh);
    setClientSeed(cs);
    setNonce(n);
    if (ss && cs && n !== "") verify(ss, ssh, cs, n);
  }, [searchParams, verify]);

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { type?: string; placeholder?: string }
  ) => (
    <div>
      <label className="text-xs font-semibold uppercase text-slate-400">{label}</label>
      <input
        type={opts?.type ?? "text"}
        value={value}
        placeholder={opts?.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-white"
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <h1 className="text-2xl font-bold text-white">{t("hilo_verify.title")}</h1>
      <p className="text-slate-400 text-sm">{t("hilo_verify.intro")}</p>

      <div className="card space-y-3">
        {field(t("hilo_verify.field_server_seed"), serverSeed, setServerSeed, {
          placeholder: t("hilo_verify.ph_server_seed"),
        })}
        {field(t("hilo_verify.field_server_seed_hash"), serverSeedHash, setServerSeedHash)}
        {field(t("hilo_verify.field_client_seed"), clientSeed, setClientSeed)}
        {field(t("hilo_verify.field_nonce"), nonce, setNonce, { type: "number" })}

        <button
          type="button"
          onClick={() => verify(serverSeed, serverSeedHash, clientSeed, nonce)}
          className="w-full rounded-lg bg-amber-500 py-2.5 font-bold text-slate-900 hover:bg-amber-400"
        >
          {t("hilo_verify.verify_btn")}
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-500/20 p-4 text-red-300">{errorMsg}</div>
      )}

      {done && (
        <div className="card space-y-4">
          {hashMatches !== null &&
            (hashMatches ? (
              <p className="text-lg font-semibold text-green-400">{t("hilo_verify.hash_ok")}</p>
            ) : (
              <p className="text-lg font-semibold text-red-400">{t("hilo_verify.hash_bad")}</p>
            ))}
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
