import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/lib/current-user";
import { getWalletBolisBalance, sweepBolisToTreasury } from "@/lib/solana";
import { getDepositKeypair } from "@/lib/deposit-wallet";

export async function POST() {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: wallets, error } = await supabase
    .from("deposit_wallets")
    .select("user_id, public_key, encrypted_private_key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!wallets || wallets.length === 0) {
    return NextResponse.json({ ok: true, swept: 0, results: [], message: "No hay wallets de depósito." });
  }

  const results: {
    userId: string;
    address: string;
    bolis: number;
    status: "swept" | "skipped" | "error";
    txSignature?: string;
    error?: string;
  }[] = [];

  let totalSwept = 0;

  for (const w of wallets) {
    let balance = 0;
    try {
      balance = await getWalletBolisBalance(w.public_key);
    } catch {
      results.push({
        userId: w.user_id,
        address: w.public_key,
        bolis: 0,
        status: "error",
        error: "No se pudo leer el saldo on-chain",
      });
      continue;
    }

    if (balance <= 0) {
      results.push({
        userId: w.user_id,
        address: w.public_key,
        bolis: 0,
        status: "skipped",
      });
      continue;
    }

    try {
      const kp = getDepositKeypair(w.encrypted_private_key);
      const sig = await sweepBolisToTreasury(kp, balance);
      if (sig) {
        totalSwept += balance;
        results.push({
          userId: w.user_id,
          address: w.public_key,
          bolis: balance,
          status: "swept",
          txSignature: sig,
        });
      } else {
        results.push({
          userId: w.user_id,
          address: w.public_key,
          bolis: balance,
          status: "error",
          error: "Treasury wallet no configurada",
        });
      }
    } catch (e) {
      results.push({
        userId: w.user_id,
        address: w.public_key,
        bolis: balance,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    swept: results.filter((r) => r.status === "swept").length,
    totalBolis: totalSwept,
    results,
  });
}
