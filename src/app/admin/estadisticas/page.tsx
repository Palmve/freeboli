import { createClient } from "@/lib/supabase/server";

export default async function AdminEstadisticasPage() {
  const supabase = await createClient();
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  const { data: balances } = await supabase.from("balances").select("points");
  const totalPoints = balances?.reduce((s, b) => s + Number(b.points ?? 0), 0) ?? 0;
  const { data: movements } = await supabase
    .from("movements")
    .select("type, points, created_at")
    .limit(5000);
  const byType =
    movements?.reduce(
      (acc, m) => {
        const t = m.type;
        acc[t] = (acc[t] || 0) + Number(m.points || 0);
        return acc;
      },
      {} as Record<string, number>
    ) ?? {};

  // Ganancia / pérdida neta (sumatoria de puntos en movements)
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  let netTotal = 0;
  let netDay = 0;
  let netWeek = 0;
  let netMonth = 0;

  for (const m of movements ?? []) {
    const pts = Number(m.points || 0);
    netTotal += pts;
    if (!m.created_at) continue;
    const t = new Date(m.created_at as string).getTime();
    const diff = now.getTime() - t;
    if (diff <= msPerDay) netDay += pts;
    if (diff <= 7 * msPerDay) netWeek += pts;
    if (diff <= 30 * msPerDay) netMonth += pts;
  }

  // Estadísticas de jugadas HI-LO
  const { data: hiLoPlays } = await supabase
    .from("movements")
    .select("user_id, created_at")
    .eq("type", "apuesta_hi_lo")
    .order("created_at", { ascending: false })
    .limit(10000);

  const plays = hiLoPlays ?? [];

  let totalPlays = 0;
  let lastDay = 0;
  let lastWeek = 0;
  let lastMonth = 0;
  const perUser: Record<string, number> = {};

  for (const p of plays) {
    if (!p.created_at) continue;
    totalPlays += 1;
    const t = new Date(p.created_at as string).getTime();
    const diff = now.getTime() - t;
    if (diff <= msPerDay) lastDay += 1;
    if (diff <= 7 * msPerDay) lastWeek += 1;
    if (diff <= 30 * msPerDay) lastMonth += 1;
    const uid = p.user_id as string;
    perUser[uid] = (perUser[uid] || 0) + 1;
  }

  const distinctPlayers = Object.keys(perUser).length;
  const avgPerPlayer = distinctPlayers > 0 ? totalPlays / distinctPlayers : 0;
  const topPlayers = Object.entries(perUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Estadísticas</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-slate-400">Usuarios totales</p>
          <p className="text-2xl font-bold text-white">{totalUsers ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-slate-400">Puntos en circulación</p>
          <p className="text-2xl font-bold text-white">{totalPoints.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-slate-400">Equivalencia</p>
          <p className="text-2xl font-bold text-amber-400">
            {(totalPoints / 1000).toFixed(2)} BOLIS
          </p>
        </div>
      </div>
      <div className="card">
        <h3 className="font-semibold text-slate-300">Ganancias / Pérdidas (puntos netos)</h3>
        <p className="mt-1 text-xs text-slate-400">
          Suma de todos los movimientos de puntos (positivos y negativos). Valores en puntos, muestra limitada (~5000 movimientos).
        </p>
        <div className="mt-3 grid gap-3 text-sm text-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-slate-400 text-xs uppercase">Hoy</p>
            <p className={netDay >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
              {netDay.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase">Últimos 7 días</p>
            <p className={netWeek >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
              {netWeek.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase">Últimos 30 días</p>
            <p className={netMonth >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
              {netMonth.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase">Total (muestra)</p>
            <p className={netTotal >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
              {netTotal.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold text-slate-300">Movimientos por tipo</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(byType).map(([type, pts]) => (
              <li key={type}>
                {type}: {pts.toLocaleString()} puntos
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-300">Jugadas HI-LO</h3>
          <div className="mt-2 space-y-1 text-sm text-slate-200">
            <p>
              Total (muestra): <strong>{totalPlays}</strong>
            </p>
            <p>
              Últimas 24h: <strong>{lastDay}</strong>
            </p>
            <p>
              Últimos 7 días: <strong>{lastWeek}</strong>
            </p>
            <p>
              Últimos 30 días: <strong>{lastMonth}</strong>
            </p>
            <p>
              Jugadores únicos: <strong>{distinctPlayers}</strong>
            </p>
            <p>
              Promedio por jugador: <strong>{avgPerPlayer.toFixed(2)}</strong>
            </p>
          </div>
          {topPlayers.length > 0 && (
            <div className="mt-3 border-t border-slate-700 pt-2 text-xs text-slate-300">
              <p className="font-semibold">Top 5 jugadores más activos</p>
              <ul className="mt-1 space-y-0.5">
                {topPlayers.map(([userId, count]) => (
                  <li key={userId} className="font-mono">
                    {userId.slice(0, 8)}…: {count} jugadas
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
