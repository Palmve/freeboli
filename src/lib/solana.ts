import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction, getAccount } from "@solana/spl-token";
import bs58 from "bs58";
import { BOLIS_MINT, POINTS_PER_BOLIS } from "./config";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

/** Mensaje amigable si el RPC devuelve 401 (falta API key en la URL). */
function friendlyRpcError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("401") || msg.includes("missing api key")) {
    return (
      "RPC requiere API key. En .env.local pon SOLANA_RPC_URL con la URL completa, por ejemplo: " +
      "Helius: https://mainnet.helius-rpc.com/?api_key=TU_KEY. " +
      "Reinicia el servidor (npm run dev) después de guardar."
    );
  }
  return msg;
}

export function getTreasuryKeypair(): Keypair | null {
  const secret = process.env.SOLANA_WALLET_PRIVATE_KEY_BASE58;
  if (!secret) return null;
  try {
    const bytes = bs58.decode(secret);
    return Keypair.fromSecretKey(bytes);
  } catch {
    return null;
  }
}

export function getTreasuryPublicKey(): string | null {
  const kp = getTreasuryKeypair();
  return kp ? kp.publicKey.toBase58() : null;
}

/** Saldo SOL y BOLIS de la wallet del sitio (para admin). */
export async function getTreasuryBalance(): Promise<{
  address: string | null;
  sol: number;
  bolis: number;
  error?: string;
}> {
  const kp = getTreasuryKeypair();
  if (!kp) {
    return { address: null, sol: 0, bolis: 0, error: "Wallet no configurada (SOLANA_WALLET_PRIVATE_KEY_BASE58)" };
  }
  const conn = new Connection(RPC);
  try {
    const [solLamports, ata] = await Promise.all([
      conn.getBalance(kp.publicKey),
      getAssociatedTokenAddress(new PublicKey(BOLIS_MINT), kp.publicKey),
    ]);
    let bolis = 0;
    try {
      const account = await getAccount(conn, ata);
      if (account?.amount != null) bolis = Number(account.amount) / 1e6;
    } catch {
      // No token account or no balance
    }
    return {
      address: kp.publicKey.toBase58(),
      sol: solLamports / 1e9,
      bolis,
    };
  } catch (e) {
    return {
      address: kp.publicKey.toBase58(),
      sol: 0,
      bolis: 0,
      error: friendlyRpcError(e),
    };
  }
}

export async function getTreasuryTokenAccount(): Promise<PublicKey | null> {
  const kp = getTreasuryKeypair();
  if (!kp) return null;
  const mint = new PublicKey(BOLIS_MINT);
  const conn = new Connection(RPC);
  const ata = await getAssociatedTokenAddress(
    mint,
    kp.publicKey
  );
  return ata;
}

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

/** Extrae el memo de una transacción parseada (programa Memo de Solana). */
export function getMemoFromParsedTransaction(tx: { transaction?: { message?: { instructions?: unknown[] } } }): string | null {
  const instructions = tx?.transaction?.message?.instructions ?? [];
  for (const ix of instructions) {
    const parsed = ix as { programId?: string; program?: string; data?: string; parsed?: { type?: string; data?: string } };
    const id = parsed.programId ?? parsed.program;
    if (id === MEMO_PROGRAM_ID || (typeof id === "string" && id.includes("Memo"))) {
      const data = parsed.data ?? parsed.parsed?.data;
      if (typeof data === "string" && data.trim()) return data.trim();
    }
  }
  return null;
}

/** Verifica una tx de transferencia de BOLIS al treasury y devuelve cantidad (en unidades del token). */
export async function verifyIncomingBolisTransfer(
  txSignature: string,
  expectedDestinationWallet: string
): Promise<{ amount: number; memo?: string } | null> {
  const conn = new Connection(RPC);
  const tx = await conn.getParsedTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.meta) return null;
  const destPubkey = new PublicKey(expectedDestinationWallet);
  let amount = 0;
  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];
  for (let i = 0; i < post.length; i++) {
    const p = post[i];
    if (p.mint === BOLIS_MINT && p.owner === destPubkey.toBase58()) {
      const preBal = pre.find(
        (x) => x.accountIndex === p.accountIndex
      )?.uiTokenAmount?.uiAmount ?? 0;
      const postBal = p.uiTokenAmount?.uiAmount ?? 0;
      amount += postBal - preBal;
    }
  }
  if (amount <= 0) return null;
  const memo = getMemoFromParsedTransaction(tx as Parameters<typeof getMemoFromParsedTransaction>[0]);
  return { amount, memo: memo ?? undefined };
}

/** Convierte cantidad de BOLIS (decimal) a puntos. */
export function bolisToPoints(bolisAmount: number): number {
  return Math.floor(bolisAmount * POINTS_PER_BOLIS);
}

/** Envía BOLIS desde el treasury a una wallet. amount = cantidad en BOLIS (decimal). */
export async function sendBolisToWallet(
  destinationWallet: string,
  amountBolis: number
): Promise<string | null> {
  const kp = getTreasuryKeypair();
  if (!kp) return null;
  const conn = new Connection(RPC);
  const mint = new PublicKey(BOLIS_MINT);
  const destPubkey = new PublicKey(destinationWallet);
  const sourceAta = await getAssociatedTokenAddress(mint, kp.publicKey);
  const destAta = await getAssociatedTokenAddress(mint, destPubkey);
  const decimals = 6;
  const amountRaw = BigInt(Math.round(amountBolis * 10 ** decimals));
  const ix = createTransferInstruction(
    sourceAta,
    destAta,
    kp.publicKey,
    amountRaw
  );
  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = kp.publicKey;
  tx.sign(kp);
  const sig = await conn.sendTransaction(tx, [kp], { skipPreflight: false });
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
  return sig;
}

/** Transfiere BOLIS desde una wallet de depósito de usuario al treasury (sweep). */
export async function sweepBolisToTreasury(
  fromKeypair: Keypair,
  amountBolis: number
): Promise<string | null> {
  const treasury = getTreasuryKeypair();
  if (!treasury) return null;
  const conn = new Connection(RPC);
  const mint = new PublicKey(BOLIS_MINT);
  const sourceAta = await getAssociatedTokenAddress(mint, fromKeypair.publicKey);
  const destAta = await getAssociatedTokenAddress(mint, treasury.publicKey);
  const decimals = 6;
  const amountRaw = BigInt(Math.round(amountBolis * 10 ** decimals));
  const ix = createTransferInstruction(
    sourceAta,
    destAta,
    fromKeypair.publicKey,
    amountRaw
  );
  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromKeypair.publicKey;
  tx.sign(fromKeypair);
  const sig = await conn.sendTransaction(tx, [fromKeypair], { skipPreflight: false });
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
  return sig;
}
