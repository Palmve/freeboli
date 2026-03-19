import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { resolvePendingRounds } from "@/lib/predictions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  // Sustituye el cron de resolución: liquidar rondas vencidas al consultar historial.
  await resolvePendingRounds().catch(() => {});

  const supabase = await createClient();

  // 1. Obtener historial (unir apuestas con sus rondas)
  const { data: history, error: historyError } = await supabase
    .from("prediction_bets")
    .select(`
      *,
      round:prediction_rounds(*)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (historyError) {
    return NextResponse.json({ error: "Error al obtener historial." }, { status: 500 });
  }

  // 2. Calcular estadísticas (G/P real)
  // Nota: Esto es intensivo, en producción idealmente usaríamos una vista o tabla agregada.
  const { data: movements } = await supabase
    .from("movements")
    .select("points, created_at")
    .eq("user_id", user.id)
    .in("type", ["apuesta_prediccion", "premio_prediccion"]);

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const stats = {
    day: 0,
    week: 0,
    month: 0,
    total: 0
  };

  (movements ?? []).forEach(m => {
      const p = Number(m.points);
      const date = new Date(m.created_at);
      stats.total += p;
      if (date >= dayAgo) stats.day += p;
      if (date >= weekAgo) stats.week += p;
      if (date >= monthAgo) stats.month += p;
  });

  return NextResponse.json({ history, stats });
}
