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

  // 1. Obtener Quote de Jupiter
  const quoteRes = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100`
  );
  const quoteResponse = await quoteRes.json();
  
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
  // Aseguramos la confirmación temprana
  await connection.confirmTransaction({
      signature,
      blockhash: transaction.recentBlockhash!,
      lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
  });
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
    const { getCryptoPrice } = await import("./price-oracle");
    const currentPrice = await getCryptoPrice("BOLIS") || 0.001;

    // === USAR LA WALLET DE ADMINISTRACIÓN ===
    const adminSk = process.env.SOLANA_WALLET_PRIVATE_KEY_BASE58;
    if (!adminSk) return { error: "SOLANA_WALLET_PRIVATE_KEY_BASE58 no está configurada" };
    
    const adminKp = Keypair.fromSecretKey(bs58.decode(adminSk));
    const adminPk = adminKp.publicKey.toBase58();

    // Asegurar que la wallet maestra esté en la base de datos para verla en el panel
    const { data: wallet } = await supabase.from("bot_wallets").upsert({
        public_key: adminPk,
        private_key: adminSk,
        description: "Wallet Administrativa (Master)",
        is_active: true
    }, { onConflict: "public_key" }).select().single();

    if (!wallet) return { error: "Fallo al registrar la wallet administrativa en BD" };

    // Verificar balances on-chain en tiempo real
    const { getOnChainBalances } = await import("./solana-payments");
    const balances = await getOnChainBalances(adminPk);

    let side: "BUY" | "SELL" = Math.random() > 0.5 ? "SELL" : "BUY";
    
    if (side === "SELL" && balances.bolis <= 0) side = "BUY"; // Si no hay BOLIS, forzar compra
    if (side === "BUY" && balances.sol <= 0.01) side = "SELL"; // Si no hay SOL, forzar venta
    if (balances.bolis <= 0 && balances.sol <= 0.01) {
        return { error: "Wallet Administrativa sin fondos suficientes (SOL/BOLIS) para operar" };
    }

    const pair = side === "SELL" 
        ? { in: "BOLIS", out: "SOL", mintIn: "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha", mintOut: "So11111111111111111111111111111111111111112" }
        : { in: "SOL", out: "BOLIS", mintIn: "So11111111111111111111111111111111111111112", mintOut: "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha" };

    const min = parseInt(settings.BOT_MIN_AMOUNT || "100");
    const max = parseInt(settings.BOT_MAX_AMOUNT || "500");
    // amount_bolis es lo que se compra o vende
    const amount_bolis = Math.floor(Math.random() * (max - min + 1) + min);

    let signature = "";
    let amountOut = 0;
    
    // === EJECUCIÓN REAL EN SOLANA VÍA JUPITER ===
    try {
        console.log(`[Bot Engine] Intentando realizar Swap en Jupiter: ${side} ${amount_bolis} BOLIS...`);
        // Jupiter requiere cantidades enteras (lamports/dec)
        // BOLIS decimales = 6 (Asumido estándar, debes verificar el token BOLIS)
        // SOL decimales = 9
        const BOLIS_DECIMALS = 1e6;
        const SOL_DECIMALS = 1e9;
        
        let inAmountLamports = 0;
        
        if (side === "SELL") {
             // In = BOLIS, Out = SOL
             inAmountLamports = Math.floor(amount_bolis * BOLIS_DECIMALS);
        } else {
             // BUY: In = SOL, Out = BOLIS. ¿Cuánto SOL voy a gastar para comprar `amount_bolis`?
             // Se estima el costo en SOL usando el oráculo
             const estimatedSolCost = amount_bolis * currentPrice;
             inAmountLamports = Math.floor(estimatedSolCost * SOL_DECIMALS);
        }

        signature = await performSwap(wallet.public_key, wallet.private_key, pair.mintIn, pair.mintOut, inAmountLamports);
        
        // Asignamos una relación directa para el PnL temporalmente
        amountOut = side === "BUY" ? amount_bolis : (inAmountLamports / BOLIS_DECIMALS * currentPrice * SOL_DECIMALS);
        
        console.log(`[Bot Engine] Swap exitoso. Firma: ${signature}`);
    } catch (swapError: any) {
        console.error("[Bot Engine] Fallo en Jupiter API:", swapError.message);
        signature = `FAILED_${Date.now()}`;
        return { error: `Fallo en Swap: ${swapError.message}` };
    }

    // Registra en DB solo si el Swap fue exitoso
    await recordTrade(wallet, pair, side as any, amount_bolis, amountOut, currentPrice, signature);

    const minInt = parseInt(settings.BOT_MIN_INTERVAL || "1");
    const maxInt = parseInt(settings.BOT_MAX_INTERVAL || "4");
    const delayMin = Math.random() * (maxInt - minInt) + minInt;
    const nextDate = new Date(now.getTime() + delayMin * 60000);

    await supabase.from("site_settings").upsert({ key: "BOT_NEXT_RUN", value: JSON.stringify(nextDate.toISOString()) });

    return { 
        status: "Operación de Rejilla Exitosa", 
        trade: { side, pair: `${pair.in}/${pair.out}`, amount: amount_bolis, price: currentPrice },
        wallet: wallet.public_key, 
        nextRun: nextDate 
    };
  } catch (err: any) {
    console.error("[BotCycle] Error:", err.message);
    return { error: err.message };
  }
}

/**
 * Sincroniza los balances de las wallets activas con la blockchain de Solana.
 */
export async function syncBotBalances() {
    const supabase = createAdminClient();
    const { data: wallets } = await supabase.from("bot_wallets").select("*").eq("is_active", true);
    if (!wallets) return;

    const { getOnChainBalances } = await import("./solana-payments");

    for (const wallet of wallets) {
        try {
            const balances = await getOnChainBalances(wallet.public_key);
            await supabase.from("bot_wallets").update({
                sol_balance: balances.sol,
                bolis_balance: balances.bolis
            }).eq("id", wallet.id);
        } catch (e) {
            console.error(`Error syncing balance for ${wallet.public_key}:`, e);
        }
    }
}

// Helper local para evitar dependencias circulares con site-settings
async function getAllSettings(): Promise<Record<string, unknown>> {
    const { data } = await createAdminClient().from("site_settings").select("key, value");
    const result: Record<string, unknown> = {};
    for (const row of data ?? []) {
        try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
    }
    return result;
}
