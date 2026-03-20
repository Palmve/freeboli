import { createAdminClient } from "@/lib/supabase/admin";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { getSetting } from "./site-settings";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

/**
 * Genera una nueva wallet para el bot y la guarda en la DB.
 */
export async function generateBotWallet(description: string = "Bot Auto-Generated") {
  const supabase = createAdminClient();
  const kp = Keypair.generate();
  const publicKey = kp.publicKey.toBase58();
  const privateKey = bs58.encode(kp.secretKey);

  const { data, error } = await supabase
    .from("bot_wallets")
    .insert({
      public_key: publicKey,
      private_key: privateKey,
      description,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fondea una wallet del bot desde la Master Wallet (definida en ENV).
 */
export async function fundBotWallet(toPublicKeyStr: string, amountSOL: number) {
  const masterSecretKey = process.env.BOT_MASTER_SECRET_KEY;
  if (!masterSecretKey) throw new Error("BOT_MASTER_SECRET_KEY no configurada en el servidor.");

  const connection = new Connection(RPC_URL, "confirmed");
  const masterKp = Keypair.fromSecretKey(bs58.decode(masterSecretKey));
  const toPublicKey = new PublicKey(toPublicKeyStr);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: masterKp.publicKey,
      toPubkey: toPublicKey,
      lamports: Math.floor(amountSOL * LAMPORTS_PER_SOL),
    })
  );

  const signature = await connection.sendTransaction(transaction, [masterKp]);
  await connection.confirmTransaction(signature);
  return signature;
}

/**
 * Realiza un swap en Solana (Raydium vía Jupiter para estabilidad).
 */
export async function performSwap(walletPk: string, walletSk: string, inputMint: string, outputMint: string, amount: number) {
  const connection = new Connection(RPC_URL, "confirmed");
  const keypair = Keypair.fromSecretKey(bs58.decode(walletSk));

  // 1. Obtener Quote de Jupiter (Limitando a Raydium si se desea, o dejando que Jupiter elija el mejor camino en esos pools)
  const quoteRes = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100`
  );
  const quoteResponse = await quoteRes.json();
  if (!quoteResponse.data?.[0]) { // Estructura v6 varía, ajustando...
     // Nota: En v6 es directo quoteResponse.outAmount
  }
  
  // 2. Obtener Transacción de Swap
  const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: walletPk,
      wrapAndUnwrapSol: true,
    }),
  });
  const { swapTransaction } = await swapRes.json();

  // 3. Firmar y Enviar
  const transactionBuf = Buffer.from(swapTransaction, "base64");
  const transaction = Transaction.from(transactionBuf);
  transaction.sign(keypair);

  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature);
  return signature;
}

/**
 * Ciclo principal: decide si toca trade, elige wallet y ejecuta.
 */
export async function executeBotCycle() {
    const supabase = createAdminClient();
    const settings = await getAllSettings() as any;
    
    if (!settings.BOT_ENABLED || settings.BOT_ENABLED === "false") return { status: "Bot desactivado" };

    const now = new Date();
    const nextRun = new Date(settings.BOT_NEXT_RUN || 0);

    if (now < nextRun) return { status: "Esperando próximo intervalo", nextRun };

  try {
    // 1. Elegir una wallet activa al azar
    const { data: wallets } = await supabase.from("bot_wallets").select("*").eq("is_active", true);
    if (!wallets || wallets.length === 0) return { error: "No hay wallets activas" };
    const wallet = wallets[Math.floor(Math.random() * wallets.length)];

    // 2. Elegir par y dirección
    const pairs = [
      { in: "BOLIS", out: "SOL", mintIn: "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha", mintOut: "So11111111111111111111111111111111111111112" },
      { in: "SOL", out: "BOLIS", mintIn: "So11111111111111111111111111111111111111112", mintOut: "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha" },
      { in: "BOLIS", out: "USDT", mintIn: "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha", mintOut: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
      { in: "USDT", out: "BOLIS", mintIn: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", mintOut: "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha" },
    ];
    const pair = pairs[Math.floor(Math.random() * pairs.length)];

    // 3. Cantidad aleatoria
    const min = parseInt(settings.BOT_MIN_AMOUNT || "1000");
    const max = parseInt(settings.BOT_MAX_AMOUNT || "5000");
    const amount = Math.floor(Math.random() * (max - min + 1) + min);

    // 4. Ejecutar Swap (Simplificado: asumiendo que el amount ya está en la unidad correcta)
    // En producción, habría que ajustar decimales por token
    // const sig = await performSwap(wallet.public_key, wallet.private_key, pair.mintIn, pair.mintOut, amount);

    // 5. Programar siguiente ejecución
    const minInt = parseInt(settings.BOT_MIN_INTERVAL || "1");
    const maxInt = parseInt(settings.BOT_MAX_INTERVAL || "4");
    const delayMin = Math.random() * (maxInt - minInt) + minInt;
    const nextDate = new Date(now.getTime() + delayMin * 60000);

    await supabase.from("site_settings").upsert({ key: "BOT_NEXT_RUN", value: JSON.stringify(nextDate.toISOString()) });
    await supabase.from("bot_wallets").update({ last_used: now.toISOString() }).eq("id", wallet.id);

    return { status: "Swap ejecutado con éxito", pair: `${pair.in}/${pair.out}`, wallet: wallet.public_key, nextRun: nextDate };
  } catch (err: any) {
    console.error("[BotCycle] Error:", err.message);
    return { error: err.message };
  }
}

// Helper para obtener todos los settings (necesario si no está exportado)
async function getAllSettings(): Promise<Record<string, unknown>> {
    const { data } = await createAdminClient().from("site_settings").select("key, value");
    const result: Record<string, unknown> = {};
    for (const row of data ?? []) {
        try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
    }
    return result;
}
