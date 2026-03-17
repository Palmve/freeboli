import { createClient } from "@/lib/supabase/server";
import AdminUsuariosTable from "./AdminUsuariosTable";

export default async function AdminUsuariosPage() {
  const supabase = await createClient();

  const [profilesRes, balancesRes, movementsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, name, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("balances").select("user_id, points"),
    supabase
      .from("movements")
      .select("user_id, type, points")
      .in("type", ["deposito_bolis", "retiro_bolis"]),
  ]);

  const profiles = profilesRes.data ?? [];
  const balanceByUser: Record<string, number> = {};
  (balancesRes.data ?? []).forEach((b) => {
    balanceByUser[b.user_id] = Number(b.points) ?? 0;
  });

  const depositoByUser: Record<string, number> = {};
  const retiroByUser: Record<string, number> = {};
  (movementsRes.data ?? []).forEach((m) => {
    const uid = m.user_id;
    const pts = Number(m.points) || 0;
    if (m.type === "deposito_bolis") {
      depositoByUser[uid] = (depositoByUser[uid] ?? 0) + pts;
    } else {
      retiroByUser[uid] = (retiroByUser[uid] ?? 0) + pts;
    }
  });

  const users = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    created_at: p.created_at,
    balance: balanceByUser[p.id] ?? 0,
    totalDeposito: depositoByUser[p.id] ?? 0,
    totalRetiro: retiroByUser[p.id] ?? 0,
  }));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Usuarios</h2>
      <AdminUsuariosTable users={users} />
    </div>
  );
}
