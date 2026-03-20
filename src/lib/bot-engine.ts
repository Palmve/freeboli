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
      is_active: true,
      sol_balance: 5.0, // Fondeo simulado inicial
      bolis_balance: 50000.0 // Fondeo simulado inicial
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
 * Registra una operación en la base de datos y calcula PnL si es venta.
 */
async function recordTrade(wallet: any, pair: any, side: "BUY" | "SELL", amountIn: number, amountOut: number, price: number, signature: string) {
    const supabase = createAdminClient();
    let pnl = 0;
    const fee = 0.000005; // Estimación simple de gas SOL

    if (side === "SELL") {
        // PnL = (Precio Venta - Precio Compra Medio) * Cantidad
        const costBasis = wallet.avg_buy_price || price;
        pnl = (price - costBasis) * amountIn;
    }

    await supabase.from("bot_trades").insert({
        wallet_id: wallet.id,
        pair: `${pair.in}/${pair.out}`,
        side,
        amount_in: amountIn,
        amount_out: amountOut,
        price,
        fee,
        pnl,
        tx_signature: signature
    });

    // Actualizar balances en la wallet (En producción esto se haría vía RPC real)
    const newBolis = side === "BUY" ? (wallet.bolis_balance + amountOut) : (wallet.bolis_balance - amountIn);
    const newSol = side === "BUY" ? (wallet.sol_balance - (amountIn / 1e9)) : (wallet.sol_balance + (amountOut / 1e9));
    
    // Actualizar precio medio de compra si fue BUY
    let newAvgPrice = wallet.avg_buy_price;
    if (side === "BUY") {
        const totalBolis = wallet.bolis_balance + amountOut;
        newAvgPrice = ((wallet.avg_buy_price * wallet.bolis_balance) + (price * amountOut)) / totalBolis;
    }

    await supabase.from("bot_wallets").update({
        bolis_balance: newBolis,
        sol_balance: newSol,
        avg_buy_price: newAvgPrice,
        last_used: new Date().toISOString()
    }).eq("id", wallet.id);
}

/**
 * Ciclo principal evolucionado (Grid / Inventario)
 */
export async function executeBotCycle() {
    const supabase = createAdminClient();
    const settings = await getAllSettings() as any;
    
    if (!settings.BOT_ENABLED || settings.BOT_ENABLED === "false") return { status: "Bot desactivado" };

    const now = new Date();
    const nextRun = new Date(settings.BOT_NEXT_RUN || 0);
    if (now < nextRun) return { status: "Esperando próximo intervalo", nextRun };

  try {
    // 1. Obtener precio actual (desde oráculo existente)
    const { getCryptoPrice } = await import("./price-oracle");
    const currentPrice = await getCryptoPrice("BOLIS") || 0.001; // Fallback

    // 2. Decisión de Side (Buy/Sell) basada en inventario y azar
    // Estrategia: Si el bot tiene muchas wallets con BOLIS, intenta vender.
    const { data: wallets } = await supabase.from("bot_wallets").select("*").eq("is_active", true);
    if (!wallets || wallets.length === 0) return { error: "No hay wallets activas" };

    // Demo Boost: Si todas las wallets tienen poco balance (< 0.5 SOL), fondear una para demo
    const totalSol = wallets.reduce((s,w) => s + (w.sol_balance || 0), 0);
    if (totalSol < 0.5) {
        console.log("[BotEngine] Inyectando Demo Boost en wallet principal...");
        await supabase.from("bot_wallets").update({ sol_balance: 5.0, bolis_balance: 25000 }).eq("id", wallets[0].id);
        wallets[0].sol_balance = 5.0;
        wallets[0].bolis_balance = 25000;
    }

    // Filtrar wallets que pueden vender (tienen BOLIS) o comprar (tienen SOL)
    const canSell = wallets.filter(w => w.bolis_balance > 0);
    const canBuy = wallets.filter(w => w.sol_balance > 0.01);

    let wallet, side, pair;
    
    // Probabilidad: 60% seguir tendencia, 40% rellenar inventario
    if (canSell.length > 0 && (Math.random() > 0.5 || canBuy.length === 0)) {
        wallet = canSell[Math.floor(Math.random() * canSell.length)];
        side = "SELL";
        pair = { in: "BOLIS", out: "SOL", mintIn: "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha", mintOut: "So11111111111111111111111111111111111111112" };
    } else if (canBuy.length > 0) {
        wallet = canBuy[Math.floor(Math.random() * canBuy.length)];
        side = "BUY";
        pair = { in: "SOL", out: "BOLIS", mintIn: "So11111111111111111111111111111111111111112", mintOut: "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha" };
    } else {
        return { error: "Sin fondos suficientes en las wallets para operar" };
    }

    // 3. Cantidad aleatoria
    const min = parseInt(settings.BOT_MIN_AMOUNT || "1000");
    const max = parseInt(settings.BOT_MAX_AMOUNT || "5000");
    const amount = Math.floor(Math.random() * (max - min + 1) + min);

    // 4. Ejecución (Simulada para trazabilidad, activar performSwap cuando esté listo)
    const signature = `local_sim_${Date.now()}`; 
    const amountOut = side === "BUY" ? amount : (amount * currentPrice * 1e9); // Simplificación
    
    await recordTrade(wallet, pair, side as any, amount, amountOut, currentPrice, signature);

    // 5. Programar siguiente ejecución
    const minInt = parseInt(settings.BOT_MIN_INTERVAL || "1");
    const maxInt = parseInt(settings.BOT_MAX_INTERVAL || "4");
    const delayMin = Math.random() * (maxInt - minInt) + minInt;
    const nextDate = new Date(now.getTime() + delayMin * 60000);

    await supabase.from("site_settings").upsert({ key: "BOT_NEXT_RUN", value: JSON.stringify(nextDate.toISOString()) });

    return { 
        status: "Operación de Rejilla Exitosa", 
        trade: { side, pair: `${pair.in}/${pair.out}`, amount, price: currentPrice },
        wallet: wallet.public_key, 
        nextRun: nextDate 
    };
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
