import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { MIN_WITHDRAW_POINTS, POINTS_PER_BOLIS } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { alertWithdrawalRequest } from "@/lib/telegram";
import { getSetting } from "@/lib/site-settings";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(currentUser.status)) {
    return NextResponse.json({ error: "Tu cuenta está suspendida o bloqueada." }, { status: 403 });
  }
  const userId = currentUser.id;

  const withdrawRateMax = await getSetting<number>("WITHDRAW_RATE_MAX", 5);
  const withdrawWindowHours = await getSetting<number>("WITHDRAW_RATE_WINDOW_HOURS", 1);
  const windowMs = withdrawWindowHours * 60 * 60 * 1000;
  const { allowed, retryAfterSeconds } = rateLimit(`withdraw:${userId}`, withdrawRateMax, windowMs);
  if (!allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes de retiro. Espera ${Math.ceil(retryAfterSeconds / 60)} minuto(s).` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const points = Number(body.points);
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  if (!Number.isInteger(points) || points < MIN_WITHDRAW_POINTS || !wallet || wallet.length < 32) {
    return NextResponse.json(
      { error: `Mínimo ${MIN_WITHDRAW_POINTS.toLocaleString()} puntos y wallet válida.` },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // 1. Ejecutar solicitud de retiro de forma atómica (Evita Race Condition)
  const { data: withdrawData, error: withdrawError } = await supabase.rpc("create_withdrawal_request", {
    target_user_id: userId,
    amount_points: points,
    dest_wallet: wallet
  });

  if (withdrawError || !withdrawData?.[0]?.success) {
    return NextResponse.json({ 
        error: withdrawError?.message || "Saldo insuficiente o error al procesar el retiro." 
    }, { status: 400 });
  }

  const withdrawalId = withdrawData[0].withdrawal_id;
  const newBalance = Number(withdrawData[0].result_balance);

  // 2. Registrar el movimiento para el historial
  await supabase.from("movements").insert({
    user_id: userId,
    type: "retiro_bolis",
    points: -points,
    reference: withdrawalId,
    metadata: { wallet_destination: wallet, status: "pending" },
  });

  const autoWithdraw = await getSetting<boolean>("WITHDRAWAL_AUTO_APPROVE", false);
  const bolisAmount = points / POINTS_PER_BOLIS;

  // Límite de 1000 BOLIS para retiros automáticos según requerimiento
  const isAutoEligible = autoWithdraw && bolisAmount <= 1000;
  let txHash = null;

  let autoError = null;

  if (isAutoEligible) {
      try {
          console.log(`[AutoWithdraw] Iniciando procesamiento automático para ${bolisAmount} BOLIS (ID: ${withdrawalId})`);
          const { sendBolisToUser, getOnChainBalances } = await import("@/lib/solana-payments");
          
          // Verificar saldo de la Master Wallet antes de intentar el envío
          const masterSecretKey = process.env.BOT_MASTER_SECRET_KEY || process.env.SOLANA_WALLET_PRIVATE_KEY_BASE58;
          if (masterSecretKey) {
              const { Keypair } = await import("@solana/web3.js");
              const bs58 = (await import("bs58")).default;
              const masterKp = Keypair.fromSecretKey(bs58.decode(masterSecretKey));
              const masterBalances = await getOnChainBalances(masterKp.publicKey.toBase58());
              
              console.log(`[AutoWithdraw] Wallet: ${masterKp.publicKey.toBase58()}, SOL: ${masterBalances.sol}, BOLIS: ${masterBalances.bolis}`);

              if (masterBalances.bolis >= bolisAmount) {
                  if (masterBalances.sol < 0.001) {
                      throw new Error(`Master Wallet sin SOL para fees (${masterBalances.sol} SOL)`);
                  }

                  const { sendBolisToWallet } = await import("@/lib/solana");
                  txHash = await sendBolisToWallet(wallet, bolisAmount);
                  
                  if (txHash) {
                      console.log(`[AutoWithdraw] Éxito. TX: ${txHash}`);
                      // 1. Actualizar estado a completado en la tabla de retiros
                      const { error: updError } = await supabase.from("withdrawals")
                        .update({ 
                            status: "completed", 
                            processed_at: new Date().toISOString(), 
                            tx_signature: txHash 
                        })
                        .eq("id", withdrawalId);
                      
                      if (updError) console.error("[AutoWithdraw] Error actualizando withdrawals:", updError.message);

                      // 2. Actualizar el metadato del movimiento para reflejar el estado completado
                      const { error: movError } = await supabase.from("movements")
                        .update({ 
                            metadata: { 
                                wallet_destination: wallet, 
                                status: "completed", 
                                tx_signature: txHash,
                                auto_processed: true
                            } 
                        })
                        .eq("reference", withdrawalId)
                        .eq("type", "retiro_bolis");
                      
                      if (movError) console.error("[AutoWithdraw] Error actualizando movements:", movError.message);
                  }
              } else {
                  const errMsg = `Saldo insuficiente en Master Wallet (${masterBalances.bolis} < ${bolisAmount}). Queda como 'pending'.`;
                  console.warn(`[AutoWithdraw] ${errMsg}`);
                  autoError = errMsg;
              }
          } else {
              const errMsg = "BOT_MASTER_SECRET_KEY no configurado.";
              console.error(`[AutoWithdraw] ${errMsg}`);
              autoError = errMsg;
          }
      } catch (err: any) {
          autoError = err.message;
          console.error("[AutoWithdraw] Error crítico:", err.message);
      }
  } else if (autoWithdraw && bolisAmount > 1000) {
      console.log(`[AutoWithdraw] Retiro superior a 1000 BOLIS (${bolisAmount}). Requiere aprobación manual.`);
  }

  console.log(`[Withdraw] Finalizado. ID: ${withdrawalId}, Eligible: ${isAutoEligible}, Tx: ${txHash}, Error: ${autoError}`);

  try {
      await alertWithdrawalRequest(currentUser.email, points, wallet);
  } catch (e) {
      console.error("Error al enviar alerta Telegram:", e);
  }

  return NextResponse.json({
    ok: true,
    withdrawalId: withdrawalId,
    balance: newBalance,
    autoProcessed: !!txHash,
    isAutoEligible: isAutoEligible,
    bolisAmount: bolisAmount,
    autoError: autoError
  });
}
