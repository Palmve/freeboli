import { NextResponse } from "next/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateServerSeed, generateClientSeed } from "@/lib/hilo";

/**
 * Devuelve la semilla activa comprometida del usuario (hash visible ANTES de apostar).
 * Nunca expone server_seed. Crea una semilla si no existe (lazy).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(user.status)) return NextResponse.json({ error: "Cuenta bloqueada." }, { status: 403 });

  const supabase = createAdminClient();
  const { serverSeed, serverSeedHash } = generateServerSeed();

  const { data, error } = await supabase.rpc("ensure_hilo_seed", {
    p_user_id: user.id,
    p_new_server_seed: serverSeed,
    p_new_server_seed_hash: serverSeedHash,
    p_new_client_seed: generateClientSeed(),
  });

  if (error || !data?.[0]) {
    return NextResponse.json({ error: error?.message || "Error al obtener la semilla." }, { status: 500 });
  }
  const row = data[0];
  return NextResponse.json({
    server_seed_hash: row.server_seed_hash,
    client_seed: row.client_seed,
    nonce: row.nonce,
  });
}
