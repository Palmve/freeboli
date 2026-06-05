import { NextResponse } from "next/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateServerSeed, generateClientSeed } from "@/lib/hilo";

/**
 * Rota la semilla: revela la server_seed activa (para verificar el historial) y
 * compromete una nueva. Opcionalmente fija el client_seed de la nueva.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(user.status)) return NextResponse.json({ error: "Cuenta bloqueada." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const newClientSeed =
    typeof body.client_seed === "string" && body.client_seed.trim()
      ? body.client_seed.trim().slice(0, 64)
      : generateClientSeed();

  const { serverSeed, serverSeedHash } = generateServerSeed();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("rotate_hilo_seed", {
    p_user_id: user.id,
    p_new_server_seed: serverSeed,
    p_new_server_seed_hash: serverSeedHash,
    p_new_client_seed: newClientSeed,
  });

  if (error || !data?.[0]) {
    return NextResponse.json({ error: error?.message || "No se pudo rotar la semilla." }, { status: 500 });
  }
  const row = data[0];
  return NextResponse.json({
    revealed: row.revealed_server_seed
      ? {
          server_seed: row.revealed_server_seed,
          server_seed_hash: row.revealed_server_seed_hash,
          client_seed: row.revealed_client_seed,
          nonce: row.revealed_nonce,
        }
      : null,
    server_seed_hash: row.new_server_seed_hash,
    client_seed: row.new_client_seed,
    nonce: 0,
  });
}
