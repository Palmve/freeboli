import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
    const supabase = createAdminClient();
    
    // 1. Buscar apuestas que siguen en 'pending'
    const { data: bets } = await supabase
        .from("prediction_bets")
        .select("*, prediction_rounds(*)")
        .eq("status", "pending");

    if (!bets || bets.length === 0) {
        return NextResponse.json({ message: "No hay apuestas pendientes que corregir." });
    }

    const results = [];

    for (const bet of bets) {
        const round = bet.prediction_rounds;
        if (!round || round.status !== "resolved") continue;

        // La ronda ya está resuelta, pero la apuesta no se procesó.
        const opening = Number(round.opening_price);
        const closing = Number(round.closing_price);
        const result = closing > opening ? "up" : closing < opening ? "down" : "draw";

        let payout = 0;
        let status = "lost";

        if (result === "draw") {
            payout = bet.amount;
            status = "draw";
        } else if (bet.side === result) {
            payout = Math.floor(bet.amount * (bet.multiplier || 1.95));
            status = "won";
        }

        // Pagar si corresponde
        if (payout > 0) {
            const { data: bal } = await supabase.from("balances").select("points").eq("user_id", bet.user_id).single();
            const currentPoints = Number(bal?.points ?? 0);
            await supabase.from("balances").upsert({ 
                user_id: bet.user_id, 
                points: currentPoints + payout,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });

            await supabase.from("movements").insert({
                user_id: bet.user_id,
                type: "premio_prediccion",
                points: payout,
                reference: `FIX:round:${round.id}:bet:${bet.id}`,
                metadata: { fix: true, round_id: round.id, bet_id: bet.id, result, side: bet.side }
            });
        }

        // Actualizar estado
        await supabase.from("prediction_bets").update({ 
            status,
            payout,
            processed_at: new Date().toISOString()
        }).eq("id", bet.id);

        results.push({ bet_id: bet.id, status, payout });
    }

    return NextResponse.json({ 
        message: "Saneamiento completado.",
        processed_count: results.length,
        details: results
    });
}
