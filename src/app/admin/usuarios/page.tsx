import { createClient } from "@/lib/supabase/server";
import AdminUsuariosTable from "./AdminUsuariosTable";
import { getUserLevel } from "@/lib/levels";

export type UserStatus = "normal" | "evaluar" | "suspendido" | "bloqueado";

export interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  balance: number;
  totalDeposito: number;
  totalRetiro: number;
  emailVerified: boolean;
  faucetClaims: number;
  betCount: number;
  daysRegistered: number;
  referralCount: number;
  sameIpUsers: number;
  status: UserStatus;
  autoStatus: UserStatus;
  flags: string[];
  level: { level: number; name: string; icon: string; color: string };
}

function computeAutoStatus(u: {
  emailVerified: boolean;
  faucetClaims: number;
  betCount: number;
  daysRegistered: number;
  balance: number;
  totalDeposito: number;
  sameIpUsers: number;
  referralCount: number;
}): { status: UserStatus; flags: string[] } {
  const flags: string[] = [];

  // Heavy faucet usage with no HI-LO engagement
  if (u.faucetClaims > 20 && u.betCount < 3) {
    flags.push("Faucet sin jugar");
  }

  // Email not verified after 3+ days
  if (!u.emailVerified && u.daysRegistered >= 3) {
    flags.push("Email no verificado");
  }

  // Multiple accounts from same IP
  if (u.sameIpUsers > 3) {
    flags.push(`${u.sameIpUsers} cuentas misma IP`);
  }

  // High balance from pure faucet (no deposits, no bets)
  if (u.balance > 5000 && u.totalDeposito === 0 && u.betCount < 5) {
    flags.push("Balance alto sin actividad real");
  }

  // Many referrals but no own activity
  if (u.referralCount > 5 && u.betCount < 5 && u.faucetClaims < 10) {
    flags.push("Muchos referidos, poca actividad propia");
  }

  // Very new account with lots of faucet claims (rapid farming)
  if (u.daysRegistered <= 1 && u.faucetClaims > 15) {
    flags.push("Farming intensivo primer día");
  }

  if (flags.length === 0) return { status: "normal", flags };
  if (flags.length >= 3) return { status: "evaluar", flags };
  return { status: "evaluar", flags };
}

export default async function AdminUsuariosPage() {
  const supabase = await createClient();

  const [profilesRes, balancesRes, movementsRes, faucetMovsRes, betsRes, referralsRes, sessionIpsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, name, created_at, email_verified_at, status")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("balances").select("user_id, points"),
    supabase
      .from("movements")
      .select("user_id, type, points")
      .in("type", ["deposito_bolis", "retiro_bolis"]),
    supabase
      .from("movements")
      .select("user_id")
      .eq("type", "faucet"),
    supabase
      .from("movements")
      .select("user_id")
      .eq("type", "apuesta_hi_lo"),
    supabase.from("referrals").select("referrer_id"),
    supabase.from("session_ips").select("user_id, ip_hash"),
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

  // Count faucet claims per user (from movements)
  const faucetByUser: Record<string, number> = {};
  (faucetMovsRes.data ?? []).forEach((f) => {
    faucetByUser[f.user_id] = (faucetByUser[f.user_id] ?? 0) + 1;
  });

  // Count bets per user
  const betsByUser: Record<string, number> = {};
  (betsRes.data ?? []).forEach((b) => {
    betsByUser[b.user_id] = (betsByUser[b.user_id] ?? 0) + 1;
  });

  // Count referrals per referrer
  const referralsByUser: Record<string, number> = {};
  (referralsRes.data ?? []).forEach((r) => {
    referralsByUser[r.referrer_id] = (referralsByUser[r.referrer_id] ?? 0) + 1;
  });

  // Count users per IP, then max shared IP users per user
  const ipsByUser: Record<string, Set<string>> = {};
  const usersByIp: Record<string, Set<string>> = {};
  (sessionIpsRes.data ?? []).forEach((s) => {
    if (!ipsByUser[s.user_id]) ipsByUser[s.user_id] = new Set();
    ipsByUser[s.user_id].add(s.ip_hash);
    if (!usersByIp[s.ip_hash]) usersByIp[s.ip_hash] = new Set();
    usersByIp[s.ip_hash].add(s.user_id);
  });

  function getMaxSharedIp(userId: string): number {
    const ips = ipsByUser[userId];
    if (!ips) return 0;
    let max = 0;
    ips.forEach((ip) => {
      const count = usersByIp[ip]?.size ?? 0;
      if (count > max) max = count;
    });
    return max;
  }

  const now = new Date();
  const users: UserRow[] = profiles.map((p) => {
    const daysRegistered = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / (24 * 60 * 60 * 1000));
    const faucetClaims = faucetByUser[p.id] ?? 0;
    const betCount = betsByUser[p.id] ?? 0;
    const balance = balanceByUser[p.id] ?? 0;
    const totalDeposito = depositoByUser[p.id] ?? 0;
    const sameIpUsers = getMaxSharedIp(p.id);
    const referralCount = referralsByUser[p.id] ?? 0;
    const emailVerified = !!p.email_verified_at;

    const auto = computeAutoStatus({
      emailVerified, faucetClaims, betCount, daysRegistered,
      balance, totalDeposito, sameIpUsers, referralCount,
    });

    const dbStatus = (p.status as UserStatus) || "normal";
    const effectiveStatus = dbStatus !== "normal" ? dbStatus : auto.status;

    const level = getUserLevel({ betCount, faucetClaims, referralCount, emailVerified });

    return {
      id: p.id,
      email: p.email,
      name: p.name,
      created_at: p.created_at,
      balance,
      totalDeposito,
      totalRetiro: retiroByUser[p.id] ?? 0,
      emailVerified,
      faucetClaims,
      betCount,
      daysRegistered,
      referralCount,
      sameIpUsers,
      status: effectiveStatus,
      autoStatus: auto.status,
      flags: auto.flags,
      level: { level: level.level, name: level.name, icon: level.icon, color: level.color },
    };
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Usuarios</h2>
      <AdminUsuariosTable users={users} />
    </div>
  );
}
