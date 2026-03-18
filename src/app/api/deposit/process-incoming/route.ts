import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  getTreasuryKeypair,
  verifyIncomingBolisTransfer,
  bolisToPoints,
  sweepBolisToTreasury,
} from "@/lib/solana";
import { getDepositKeypair } from "@/lib/deposit-wallet";
import { BOLIS_MINT } from "@/lib/config";
import { getCurrentUser } from "@/lib/current-user";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SIGS_PER_ADDRESS = 20;
const IS_PUBLIC_RPC = !process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL.includes("api.mainnet-beta.solana.com");

async function authorize(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  const user = await getCurrentUser();
  return !!user?.isAdmin;
}

/**
 * Escanea la dirección de depósito de cada usuario en busca de BOLIS recibidos,
 * acredita puntos y hace sweep al treasury (treasury paga gas).
 */
async function processDeposits() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: usersData, error: usersError } = await supabase
    .from("profiles")
    .select("id, deposit_address")
    .not("deposit_address", "is", null);

  if (usersError) {
    return NextResponse.json({
      ok: false,
      error: "Error al cargar usuarios. ¿Ejecutaste la migración 003_deposit_wallet_per_user.sql?",
      detail: usersError.message,
    }, { status: 500 });
  }

  const users: { id: string; deposit_address: string }[] = usersData ?? [];

  if (!users.length) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      message: "No hay usuarios con dirección de depósito.",
    });
  }

  const conn = new Connection(RPC);
  const mint = new PublicKey(BOLIS_MINT);
  const processed: string[] = [];
  const errors: string[] = [];
  const debug: { deposit_address: string; ata: string; signatures_found: number; skip_reasons?: string[] }[] = [];

  for (const user of users) {
    const depositAddress = user.deposit_address as string;
    try {
      const ata = await getAssociatedTokenAddress(mint, new PublicKey(depositAddress));
      const ataStr = ata.toBase58();
      let sigs: { signature: string }[] = [];
      try {
        const sigsData = await conn.getSignaturesForAddress(ata, { limit: SIGS_PER_ADDRESS }, "finalized");
        sigs = sigsData ?? [];
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const is401 = raw.includes("401") || raw.includes("missing api key");
        const msg = is401
          ? "RPC requiere API key. Configura SOLANA_RPC_URL con la URL completa (ej. Helius)."
          : `Dirección ${depositAddress}: no se pudieron obtener firmas del ATA (${ataStr}). ${raw}`;
        errors.push(msg);
        debug.push({ deposit_address: depositAddress, ata: ataStr, signatures_found: 0, skip_reasons: ["getSignaturesForAddress error"] });
        continue;
      }

      const skipReasons: string[] = [];
      for (const { signature } of sigs) {
        try {
          const { data: existing } = await supabase
            .from("processed_deposits")
            .select("tx_signature")
            .eq("tx_signature", signature)
            .single();
          if (existing) {
            skipReasons.push(`${signature.slice(0, 8)}… ya procesada`);
            continue;
          }

          const result = await verifyIncomingBolisTransfer(signature, depositAddress);
          if (!result || result.amount <= 0) {
            skipReasons.push(`${signature.slice(0, 8)}… verify null o amount<=0`);
            continue;
          }

          const pointsToAdd = bolisToPoints(result.amount);
          if (pointsToAdd <= 0) continue;

          const { data: balanceRow } = await supabase
            .from("balances")
            .select("points")
            .eq("user_id", user.id)
            .single();
          const newPoints = Number(balanceRow?.points ?? 0) + pointsToAdd;

          await supabase.from("balances").upsert(
            { user_id: user.id, points: newPoints, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
          await supabase.from("movements").insert({
            user_id: user.id,
            type: "deposito_bolis",
            points: pointsToAdd,
            reference: signature,
            metadata: { bolisAmount: result.amount },
          });

          try {
            const { data: wallet } = await supabase
              .from("deposit_wallets")
              .select("encrypted_private_key")
              .eq("user_id", user.id)
              .single();
            if (wallet?.encrypted_private_key && getTreasuryKeypair()) {
              const kp = getDepositKeypair(wallet.encrypted_private_key);
              await sweepBolisToTreasury(kp, result.amount);
            }
          } catch {
            // Sweep failed (e.g. no ATA created yet). Points already credited.
          }

          await supabase.from("processed_deposits").insert({
            tx_signature: signature,
            user_id: user.id,
            amount_bolis: result.amount,
            points_added: pointsToAdd,
          });
          processed.push(signature);
        } catch (e) {
          errors.push(`${signature}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      debug.push({
        deposit_address: depositAddress,
        ata: ataStr,
        signatures_found: sigs.length,
        skip_reasons: skipReasons.length ? skipReasons.slice(0, 8) : undefined,
      });
    } catch (e) {
      errors.push(`user ${user.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const hasZeroSigs = debug.some((d) => d.signatures_found === 0);
  const rpcHint =
    hasZeroSigs && IS_PUBLIC_RPC
      ? " El RPC público suele no devolver historial. Configura SOLANA_RPC_URL (Helius, QuickNode, etc.)."
      : "";

  return NextResponse.json({
    ok: true,
    processed: processed.length,
    users_scanned: users.length,
    signatures: processed,
    errors: errors.length ? errors : undefined,
    debug: debug.length ? debug : undefined,
    message:
      processed.length === 0 && errors.length === 0
        ? `Se escanearon ${users.length} dirección(es). No se encontraron depósitos nuevos.${rpcHint}`
        : undefined,
    rpc_hint: hasZeroSigs && IS_PUBLIC_RPC ? rpcHint : undefined,
  });
}

/** GET — Vercel Cron llama esta ruta cada 5 minutos. */
export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return processDeposits();
}

/** POST — Botón "Procesar depósitos ahora" del panel admin. */
export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return processDeposits();
}
