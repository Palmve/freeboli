import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

/**
 * Devuelve el historial de tiradas HI-LO del usuario (desde movements con tipo apuesta_hi_lo)
 * para mostrar en la tabla y construir enlaces de verificación.
 */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50", 10)), 100);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movements")
    .select("id, points, metadata, created_at")
    .eq("user_id", userId)
    .eq("type", "apuesta_hi_lo")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = (data ?? []).map((m) => {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    const bet = Math.abs(Number(m.points));
    const roll = Number(meta.roll ?? 0);
    const choice = (meta.choice === "hi" ? "HI" : "LO") as string;
    const win = Boolean(meta.win);
    const payout = Number(meta.payout ?? 0);
    const profit = win ? payout - bet : -bet;
    return {
      id: m.id,
      time: new Date(m.created_at).toISOString(),
      choice,
      roll,
      stake: bet,
      mult: win ? 2 : 0,
      profit,
      verification:
        meta.server_seed && meta.server_seed_hash && meta.client_seed != null && meta.nonce != null
          ? {
              server_seed: String(meta.server_seed),
              server_seed_hash: String(meta.server_seed_hash),
              client_seed: String(meta.client_seed),
              nonce: Number(meta.nonce),
            }
          : null,
    };
  });

  return NextResponse.json({ history: entries });
}
