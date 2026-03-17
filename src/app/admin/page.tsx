import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminWalletBalance from "./AdminWalletBalance";
import AdminGrantPoints from "./AdminGrantPoints";
import AdminProcessDeposits from "./AdminProcessDeposits";

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
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const totalPoints = (balances?.reduce((s, b) => s + Number(b.points || 0), 0) ?? 0);
  const byType =
    movements?.reduce(
      (acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + Number(m.points || 0);
        return acc;
      },
      {} as Record<string, number>
    ) ?? {};
  const pendingWithdrawals = withdrawals?.filter((w) => w.status === "pending") ?? [];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-300">Usuarios</h2>
        <p className="text-3xl font-bold text-white">{usersCount ?? 0}</p>
      </div>
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-300">Puntos totales en cuentas</h2>
        <p className="text-3xl font-bold text-white">
          {totalPoints.toLocaleString()}
        </p>
      </div>
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-300">Movimientos por tipo</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-400">
          {Object.entries(byType).map(([type, pts]) => (
            <li key={type}>
              {type}: {pts.toLocaleString()} pts
            </li>
          ))}
          {Object.keys(byType).length === 0 && <li>Sin movimientos</li>}
        </ul>
      </div>
      <div className="card md:col-span-2">
        <h2 className="text-lg font-semibold text-slate-300">Retiros pendientes</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th>Usuario</th>
                <th>Puntos</th>
                <th>Wallet</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(withdrawals ?? []).slice(0, 20).map((w) => (
                <tr key={w.id} className="border-t border-slate-700">
                  <td className="font-mono text-xs">{w.user_id}</td>
                  <td>{Number(w.points).toLocaleString()}</td>
                  <td className="font-mono text-xs truncate max-w-[120px]">{w.wallet_destination}</td>
                  <td>
                    <span
                      className={
                        w.status === "pending"
                          ? "text-amber-400"
                          : "text-green-400"
                      }
                    >
                      {w.status}
                    </span>
                  </td>
                  <td>{new Date(w.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!withdrawals || withdrawals.length === 0) && (
            <p className="py-4 text-slate-500">No hay retiros.</p>
          )}
        </div>
      </div>
      <AdminWalletBalance />
      <AdminGrantPoints />
      <AdminProcessDeposits />
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-300">Enlaces</h2>
        <ul className="mt-2 space-y-2">
          <li>
            <Link href="/admin/usuarios" className="text-amber-400 hover:underline">
              Ver usuarios
            </Link>
          </li>
          <li>
            <Link href="/admin/retiros" className="text-amber-400 hover:underline">
              Procesar retiros
            </Link>
          </li>
          <li>
            <Link href="/admin/estadisticas" className="text-amber-400 hover:underline">
              Estadísticas
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
