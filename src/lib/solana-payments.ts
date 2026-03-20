import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token";
import bs58 from "bs58";
import { BOLIS_MINT, POINTS_PER_BOLIS } from "./config";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

/**
 * Realiza una transferencia de BOLIS (SPL Token) desde la Master Wallet al usuario.
 */
export async function sendBolisToUser(toPublicKeyStr: string, pointsAmount: number) {
    const masterSecretKey = process.env.BOT_MASTER_SECRET_KEY || process.env.SOLANA_WALLET_PRIVATE_KEY_BASE58;
    if (!masterSecretKey) throw new Error("Llave maestra (BOT_MASTER_SECRET_KEY o SOLANA_WALLET_PRIVATE_KEY_BASE58) no configurada.");

    const connection = new Connection(RPC_URL, "confirmed");
    const masterKp = Keypair.fromSecretKey(bs58.decode(masterSecretKey));
    const toPublicKey = new PublicKey(toPublicKeyStr);
    const mintPublicKey = new PublicKey(BOLIS_MINT);

    // 1 BOLIS = 1000 points. BOLIS tiene usualmente 9 decimales (verificar en chain, asumo 9 estándar SPL o el que tenga el mint)
    // Sin embargo, para tokens personalizados el factor de escala depende del mint.
    // Asumiremos que el monto en DB es 1:1 con la unidad entera del token si no se especifica.
    const bolisAmount = pointsAmount / POINTS_PER_BOLIS;
    
    // Obtener decimales dinámicamente o usar constante (Bolt suele ser 9 o 6)
    const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);
    const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals ?? 9;
    const amountInUnits = Math.floor(bolisAmount * Math.pow(10, decimals));

    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        masterKp,
        mintPublicKey,
        masterKp.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        masterKp,
        mintPublicKey,
        toPublicKey
    );

    const transaction = new Transaction().add(
        createTransferInstruction(
            fromTokenAccount.address,
            toTokenAccount.address,
            masterKp.publicKey,
            amountInUnits
        )
    );

    const signature = await connection.sendTransaction(transaction, [masterKp]);
    await connection.confirmTransaction(signature);
    return signature;
}

/**
 * Obtiene el balance real (SOL y BOLIS) de una wallet en la blockchain.
 */
export async function getOnChainBalances(publicKeyStr: string) {
    const connection = new Connection(RPC_URL, "confirmed");
    const pubKey = new PublicKey(publicKeyStr);
    const mintPk = new PublicKey(BOLIS_MINT);

    // SOL Balance
    const solBalance = await connection.getBalance(pubKey) / LAMPORTS_PER_SOL;

    // BOLIS Balance (SPL)
    let bolisBalance = 0;
    try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, { mint: mintPk });
        if (tokenAccounts.value.length > 0) {
            bolisBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
        }
    } catch (e) {
        console.error(`Error fetching BOLIS balance for ${publicKeyStr}:`, e);
    }

    return { sol: solBalance, bolis: bolisBalance };
}
