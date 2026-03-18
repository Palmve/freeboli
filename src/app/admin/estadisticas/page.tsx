import { createClient } from "@/lib/supabase/server";

// Movement types from the platform's perspective
const COST_TYPES = ["faucet", "premio_hi_lo", "comision_afiliado", "logro", "recompensa", "bonus_referido_verificado", "premio_ranking"] as const;
const REVENUE_TYPES = ["apuesta_hi_lo"] as const;
const NEUTRAL_TYPES = ["deposito_bolis", "retiro_bolis"] as const;

const TYPE_LABELS: Record<string, string> = {
  faucet: "Faucet (costo)",
  premio_hi_lo: "Premios HI-LO (costo)",
  comision_afiliado: "Comisiones afiliados (costo)",
  logro: "Logros / Recompensas (costo)",
  recompensa: "Bienvenida / Promo (costo)",
  apuesta_hi_lo: "Apuestas HI-LO (ingreso)",
  bonus_referido_verificado: "Bonus referido verificado (costo)",
  premio_ranking: "Premios ranking (costo)",
  deposito_bolis: "Depósitos usuarios (neutral)",
  retiro_bolis: "Retiros usuarios (neutral)",
};

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
    .order("created_at", { ascending: false })
    .limit(10000);

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  const byType: Record<string, number> = {};
  const costsByPeriod = { day: 0, week: 0, month: 0, total: 0 };
  const revenueByPeriod = { day: 0, week: 0, month: 0, total: 0 };
  const neutralByType: Record<string, number> = {};

  for (const m of movements ?? []) {
    const pts = Math.abs(Number(m.points || 0));
    const type = m.type as string;
    byType[type] = (byType[type] || 0) + pts;

    const diff = m.created_at ? now.getTime() - new Date(m.created_at as string).getTime() : Infinity;
    const isDay = diff <= msPerDay;
    const isWeek = diff <= 7 * msPerDay;
    const isMonth = diff <= 30 * msPerDay;

    if ((COST_TYPES as readonly string[]).includes(type)) {
      costsByPeriod.total += pts;
      if (isDay) costsByPeriod.day += pts;
      if (isWeek) costsByPeriod.week += pts;
      if (isMonth) costsByPeriod.month += pts;
    } else if ((REVENUE_TYPES as readonly string[]).includes(type)) {
      revenueByPeriod.total += pts;
      if (isDay) revenueByPeriod.day += pts;
      if (isWeek) revenueByPeriod.week += pts;
      if (isMonth) revenueByPeriod.month += pts;
    } else if ((NEUTRAL_TYPES as readonly string[]).includes(type)) {
      neutralByType[type] = (neutralByType[type] || 0) + pts;
    }
  }

  const net = {
    day: revenueByPeriod.day - costsByPeriod.day,
    week: revenueByPeriod.week - costsByPeriod.week,
    month: revenueByPeriod.month - costsByPeriod.month,
    total: revenueByPeriod.total - costsByPeriod.total,
  };

  // HI-LO stats
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
    const diff = now.getTime() - new Date(p.created_at as string).getTime();
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

  function formatPts(n: number) {
    return n.toLocaleString();
  }

  function netColor(n: number) {
    return n >= 0 ? "text-emerald-400" : "text-red-400";
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Estadísticas</h2>

      {/* General KPIs */}
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

      {/* Platform P&L */}
      <div className="card space-y-4">
        <div>
          <h3 className="font-semibold text-slate-300">Balance de la plataforma (puntos)</h3>
          <p className="text-xs text-slate-500">
            Ingresos (apuestas HI-LO) menos costos (faucet, premios, comisiones, logros, bienvenida).
            Depósitos y retiros de usuarios NO se incluyen (son dinero del usuario).
          </p>
        </div>

        {/* Net P&L */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Hoy", val: net.day },
            { label: "Últimos 7 días", val: net.week },
            { label: "Últimos 30 días", val: net.month },
            { label: "Total (muestra)", val: net.total },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-slate-800/50 p-3">
              <p className="text-xs text-slate-400 uppercase">{item.label}</p>
              <p className={`text-lg font-bold ${netColor(item.val)}`}>
                {item.val >= 0 ? "+" : ""}{formatPts(item.val)}
              </p>
            </div>
          ))}
        </div>

        {/* Revenue vs Costs breakdown */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-emerald-400 mb-2">Ingresos (puntos recuperados)</h4>
            <div className="space-y-1 text-sm">
              {[
                { label: "Hoy", val: revenueByPeriod.day },
                { label: "7 días", val: revenueByPeriod.week },
                { label: "30 días", val: revenueByPeriod.month },
                { label: "Total", val: revenueByPeriod.total },
              ].map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-slate-400">{r.label}</span>
                  <span className="text-emerald-400 font-mono">+{formatPts(r.val)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-red-400 mb-2">Costos (puntos entregados)</h4>
            <div className="space-y-1 text-sm">
              {[
                { label: "Hoy", val: costsByPeriod.day },
                { label: "7 días", val: costsByPeriod.week },
                { label: "30 días", val: costsByPeriod.month },
                { label: "Total", val: costsByPeriod.total },
              ].map((r) => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-slate-400">{r.label}</span>
                  <span className="text-red-400 font-mono">-{formatPts(r.val)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown by type */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold text-slate-300">Desglose por tipo de movimiento</h3>
          <p className="text-xs text-slate-500 mb-3">Totales acumulados (muestra ~10,000)</p>
          <div className="space-y-2 text-sm">
            {Object.entries(byType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, pts]) => {
                const isCost = (COST_TYPES as readonly string[]).includes(type);
                const isRevenue = (REVENUE_TYPES as readonly string[]).includes(type);
                const color = isCost ? "text-red-400" : isRevenue ? "text-emerald-400" : "text-slate-400";
                return (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-slate-300">{TYPE_LABELS[type] || type}</span>
                    <span className={`font-mono ${color}`}>
                      {isCost ? "-" : isRevenue ? "+" : ""}{formatPts(pts)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* HI-LO stats */}
        <div className="card">
          <h3 className="font-semibold text-slate-300">Jugadas HI-LO</h3>
          <div className="mt-2 space-y-1 text-sm text-slate-200">
            <p>Total (muestra): <strong>{totalPlays}</strong></p>
            <p>Últimas 24h: <strong>{lastDay}</strong></p>
            <p>Últimos 7 días: <strong>{lastWeek}</strong></p>
            <p>Últimos 30 días: <strong>{lastMonth}</strong></p>
            <p>Jugadores únicos: <strong>{distinctPlayers}</strong></p>
            <p>Promedio por jugador: <strong>{avgPerPlayer.toFixed(2)}</strong></p>
          </div>
          {topPlayers.length > 0 && (
            <div className="mt-3 border-t border-slate-700 pt-2 text-xs text-slate-300">
              <p className="font-semibold">Top 5 jugadores más activos</p>
              <ul className="mt-1 space-y-0.5">
                {topPlayers.map(([userId, count]) => (
                  <li key={userId} className="font-mono">
                    {userId.slice(0, 8)}...: {count} jugadas
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
