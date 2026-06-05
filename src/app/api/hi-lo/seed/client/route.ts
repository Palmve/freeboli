import { NextResponse } from "next/server";
import { getCurrentUser, isUserBlocked } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fija el client_seed de la semilla activa. Solo permitido si nonce = 0
 * (antes de la primera apuesta de esa semilla); si no, hay que rotar.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (isUserBlocked(user.status)) return NextResponse.json({ error: "Cuenta bloqueada." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const clientSeed = typeof body.client_seed === "string" ? body.client_seed.trim().slice(0, 64) : "";
  if (!clientSeed) {
    return NextResponse.json({ error: "Client seed inválido (1-64 caracteres)." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("set_hilo_client_seed", {
    p_user_id: user.id,
    p_client_seed: clientSeed,
  });

  if (error || !data?.[0]?.ok) {
    return NextResponse.json({ error: data?.[0]?.message || error?.message || "No se pudo actualizar." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, client_seed: clientSeed });
}
