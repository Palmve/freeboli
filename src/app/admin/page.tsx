import { createClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/site-settings";
import AdminEmergencyPanel from "@/components/admin/AdminEmergencyPanel";
import { getAdminUser } from "@/lib/current-user";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/auth/login");
  
  // Si es staff (no Super Admin), redirigir a configuración directamente
  if (user.isStaff) {
    redirect("/admin/configuracion");
  }

  const supabase = await createClient();

  // Fetch critical values and counts
  const [
    { count: usersCount },
    { data: balances },
    { data: movements },
    { data: withdrawals },
    { count: pendingTickets },
    { count: pendingSecurity },
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
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("security_events").select("id", { count: "exact", head: true }).eq("status", "pending"),
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
  const pendingWithdrawCount = withdrawals?.length ?? 0;

  // Settings for Emergency Panel
  const withdrawalsEnabled = await getSetting<number>("WITHDRAWALS_ENABLED", 1) === 1;
  const autoApproveEnabled = await getSetting<number>("WITHDRAWAL_AUTO_APPROVE_ENABLED", 1) === 1;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* ⚠️ Panel de Emergencia */}
      <AdminEmergencyPanel 
        initialWithdrawnEnabled={withdrawalsEnabled}
        initialAutoApproveEnabled={autoApproveEnabled}
      />

      {/* KPIs Principales */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Usuarios</p>
            <span className="text-blue-400">👤</span>
          </div>
          <p className="text-4xl font-black text-white leading-none">{usersCount ?? 0}</p>
          <div className="mt-2 h-1 w-10 bg-blue-500 rounded-full"></div>
        </div>
        
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Puntos en Circulación</p>
            <span className="text-amber-400">💰</span>
          </div>
          <p className="text-2xl font-black text-white leading-none">{totalPoints.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase">≈ {(totalPoints / 1000).toFixed(2)} BOLIS</p>
        </div>

        {/* 🎫 Pendientes Soporte */}
        <div className={`p-5 rounded-2xl border transition-all ${pendingTickets && pendingTickets > 0 ? "bg-indigo-500/5 border-indigo-500/30" : "bg-slate-900/50 border-slate-800"}`}>
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pendientes Soporte</p>
            <span className="text-indigo-400">🎫</span>
          </div>
          <p className={`text-4xl font-black leading-none ${pendingTickets && pendingTickets > 0 ? "text-indigo-400" : "text-white opacity-40"}`}>
            {pendingTickets ?? 0}
          </p>
          {pendingTickets && pendingTickets > 0 && <p className="text-[10px] text-indigo-400/70 mt-1 font-bold animate-pulse">REVISIÓN REQUERIDA</p>}
        </div>

        {/* 🛡️ Seguridad */}
        <div className={`p-5 rounded-2xl border transition-all ${pendingSecurity && pendingSecurity > 0 ? "bg-red-500/5 border-red-500/30 shadow-lg shadow-red-500/5" : "bg-slate-900/50 border-slate-800"}`}>
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alertas Seguridad</p>
            <span className="text-red-400">🛡️</span>
          </div>
          <p className={`text-4xl font-black leading-none ${pendingSecurity && pendingSecurity > 0 ? "text-red-500" : "text-white opacity-40"}`}>
            {pendingSecurity ?? 0}
          </p>
          {pendingSecurity && pendingSecurity > 0 && <p className="text-[10px] text-red-500 mt-1 font-bold">ALTA PRIORIDAD</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Retiros Pendientes (2/3 ancho) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Solicitudes de Retiro ({pendingWithdrawCount})
            </h2>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            {pendingWithdrawCount > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-800/50 text-slate-400 uppercase font-black text-[10px]">
                    <tr>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Puntos</th>
                      <th className="px-6 py-4">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(withdrawals ?? []).map((w) => (
                      <tr key={w.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-6 py-4 font-mono text-slate-300">{w.user_id.slice(0, 8)}...</td>
                        <td className="px-6 py-4">
                          <span className="text-amber-400 font-black text-sm">{Number(w.points).toLocaleString()}</span>
                          <span className="text-[10px] text-slate-500 ml-1">PTS</span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(w.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-slate-500 font-medium">✨ No hay retiros pendientes</p>
              </div>
            )}
          </div>
        </div>

        {/* Resumen de Movimientos (1/3 ancho) */}
        <div className="space-y-4">
          <h2 className="text-lg font-black text-white uppercase tracking-tight px-2">Impacto Reciente</h2>
          <div className="bg-slate-950 border border-slate-900 rounded-3xl p-6 space-y-4 shadow-inner">
            {Object.entries(byType).slice(0, 8).map(([type, pts]) => (
              <div key={type} className="flex justify-between items-center group">
                <span className="text-[10px] font-bold text-slate-500 uppercase group-hover:text-slate-300 transition">{type.replace(/_/g, ' ')}</span>
                <span className={`font-mono text-xs ${pts < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {pts > 0 ? '+' : ''}{pts.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
