import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { createClient } from "@supabase/supabase-js";
import { createDepositKeypair } from "@/lib/deposit-wallet";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Inicia sesión para ver tu dirección de depósito." },
      { status: 401 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("deposit_address")
    .eq("id", userId)
    .single();

  let address = profile?.deposit_address ?? null;

  if (!address) {
    try {
      const { publicKey, encryptedPrivateKey } = createDepositKeypair();
      address = publicKey;
      const { error: errWallet } = await supabase.from("deposit_wallets").insert({
        user_id: userId,
        public_key: publicKey,
        encrypted_private_key: encryptedPrivateKey,
      });
      if (errWallet) {
        return NextResponse.json(
          { error: "No se pudo crear la wallet de depósito." },
          { status: 500 }
        );
      }
      const { error: errProfile } = await supabase
        .from("profiles")
        .update({
          deposit_address: publicKey,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (errProfile) {
        return NextResponse.json(
          { error: "No se pudo asociar la dirección al perfil." },
          { status: 500 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Depósitos no configurados (falta DEPOSIT_WALLET_ENCRYPTION_KEY)." },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({
    address,
    mint: process.env.NEXT_PUBLIC_BOLIS_MINT || "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha",
    pointsPerBolis: Number(process.env.NEXT_PUBLIC_POINTS_PER_BOLIS) || 1000,
  });
}
