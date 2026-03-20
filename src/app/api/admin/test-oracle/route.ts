import { NextResponse } from "next/server";
import { getCryptoPrice } from "@/lib/price-oracle";

export async function GET() {
    const bPrice = await getCryptoPrice("BOLIS");
    const sPrice = await getCryptoPrice("SOL");
    const tPrice = await getCryptoPrice("BTC");

    return NextResponse.json({ 
        prices: { BOLIS: bPrice, SOL: sPrice, BTC: tPrice },
        debug: {
            bolis_mint: "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha"
        }
    });
}
