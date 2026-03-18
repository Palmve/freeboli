import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();

  const [
    { count: usersCount },
    { data: balances },
    { data: movements },
    { data: withdrawals },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("balances").select("points").then((r) => r),
    supabase
      .from("movements")
      .select("type, points")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("withdrawals")
      .select("id, user_id, points, wallet_destination, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const totalPoints = balances?.reduce((s, b) => s + Number(b.points || 0), 0) ?? 0;
  const byType =
    movements?.reduce(
      (acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + Number(m.points || 0);
        return acc;
      },
      {} as Record<string, number>
    ) ?? {};
  const pendingCount = withdrawals?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-400">Usuarios</p>
          <p className="text-3xl font-bold text-white">{usersCount ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-400">Puntos en circulación</p>
          <p className="text-3xl font-bold text-white">{totalPoints.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-400">Equiv. BOLIS</p>
          <p className="text-3xl font-bold text-amber-400">{(totalPoints / 1000).toFixed(2)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-400">Retiros pendientes</p>
          <p className={`text-3xl font-bold ${pendingCount > 0 ? "text-red-400" : "text-green-400"}`}>
            {pendingCount}
          </p>
        </div>
      </div>

      {/* Movimientos por tipo */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-300">Movimientos por tipo</h2>
        <div className="mt-3 grid gap-x-6 gap-y-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 text-sm">
          {Object.entries(byType).map(([type, pts]) => (
            <div key={type}>
              <p className="text-slate-500 text-xs">{type}</p>
              <p className="text-white font-mono">{pts.toLocaleString()} pts</p>
            </div>
          ))}
          {Object.keys(byType).length === 0 && (
            <p className="text-slate-500 col-span-full">Sin movimientos</p>
          )}
        </div>
      </div>

      {/* Retiros pendientes */}
      {pendingCount > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-300">
            Retiros pendientes ({pendingCount})
          </h2>
          <div className="mt-3 overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-2 pr-3">Usuario</th>
                  <th className="pb-2 pr-3">Puntos</th>
                  <th className="pb-2 pr-3">Wallet</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {(withdrawals ?? []).map((w) => (
                  <tr key={w.id} className="border-t border-slate-700/50">
                    <td className="py-2 pr-3 font-mono text-xs">{w.user_id.slice(0, 8)}...</td>
                    <td className="py-2 pr-3 text-amber-400 font-mono">{Number(w.points).toLocaleString()}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-400 truncate max-w-[140px]">
                      {w.wallet_destination}
                    </td>
                    <td className="py-2 text-slate-400 text-xs">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
