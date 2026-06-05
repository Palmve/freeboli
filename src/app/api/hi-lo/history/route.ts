import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Devuelve el historial de tiradas HI-LO del usuario (desde movements con tipo apuesta_hi_lo)
 * para mostrar en la tabla y construir enlaces de verificación.
 *
 * - Excluye las filas de agrupación del "lazy rollup" (resúmenes diarios sin roll).
 * - Provably fair: el enlace de verificación solo se ofrece si la semilla del servidor ya
 *   fue revelada (el usuario rotó la semilla); mientras siga comprometida, no se expone.
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

  // Solo tiradas reales: las filas de agrupación (rollup) no tienen roll.
  const rolls = (data ?? []).filter((m) => {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    return meta.roll != null && meta.rollup_count == null;
  });

  // Apuestas provably-fair (con seed_id): solo verificables si la semilla fue revelada.
  const seedIds = Array.from(
    new Set(
      rolls
        .map((m) => (m.metadata as Record<string, unknown>)?.seed_id)
        .filter(Boolean) as string[]
    )
  );
  const revealedSeeds = new Map<string, string>();
  if (seedIds.length > 0) {
    const admin = createAdminClient();
    const { data: seeds } = await admin
      .from("hilo_seeds")
      .select("id, server_seed, revealed_at")
      .eq("user_id", userId)
      .in("id", seedIds)
      .not("revealed_at", "is", null);
    for (const s of seeds ?? []) revealedSeeds.set(s.id as string, s.server_seed as string);
  }

  const entries = rolls.map((m) => {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    const bet = Math.abs(Number(m.points));
    const roll = Number(meta.roll ?? 0);
    const choice = (meta.choice === "hi" ? "HI" : "LO") as string;
    const win = Boolean(meta.win);
    const payout = Number(meta.payout ?? 0);
    const odds = Number(meta.odds ?? 2);
    const profit = win ? payout - bet : -bet;

    // server_seed: directo (apuestas antiguas) o desde la semilla revelada (provably fair).
    const serverSeed = meta.server_seed
      ? String(meta.server_seed)
      : meta.seed_id
        ? revealedSeeds.get(String(meta.seed_id))
        : undefined;

    const canVerify =
      serverSeed && meta.server_seed_hash && meta.client_seed != null && meta.nonce != null;

    return {
      id: m.id,
      time: new Date(m.created_at).toISOString(),
      choice,
      roll,
      stake: bet,
      mult: win ? Number(odds.toFixed(2)) : 0,
      profit,
      verification: canVerify
        ? {
            server_seed: String(serverSeed),
            server_seed_hash: String(meta.server_seed_hash),
            client_seed: String(meta.client_seed),
            nonce: Number(meta.nonce),
          }
        : null,
    };
  });

  return NextResponse.json({ history: entries });
}
