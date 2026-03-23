import { createClient } from "@/lib/supabase/server";
import AdminUsuariosTable from "./AdminUsuariosTable";
import { getUserLevel } from "@/lib/levels";

export type UserStatus = "normal" | "evaluar" | "suspendido" | "bloqueado";

export interface UserRow {
  id: string; // UUID interno
  public_id: number | null; // ID de 6 cifras
  email: string | null;
  name: string | null;
  created_at: string;
  balance: number;
  totalDeposito: number;
  totalRetiro: number;
  emailVerified: boolean;
  faucetClaims: number;
  daysRegistered: number;
  referralCount: number;
  referralEarnings: number; // Nueva columna
  sameIpUsers: number;
  lastIp: string | null; // Nueva columna
  status: UserStatus;
  autoStatus: UserStatus;
  flags: string[];
  level: { level: number; name: string; icon: string; color: string };
  hiLoPlays: number;
  hiLoAmount: number;
  predPlays: number;
  predAmount: number;
  rankingPos: number | null;
}

function computeAutoStatus(u: {
  emailVerified: boolean;
  faucetClaims: number;
  hiLoPlays: number;
  predPlays: number;
  daysRegistered: number;
  balance: number;
  totalDeposito: number;
  sameIpUsers: number;
  referralCount: number;
}): { status: UserStatus; flags: string[] } {
  const flags: string[] = [];

  // Heavy faucet usage with no engagement
  if (u.faucetClaims > 20 && (u.hiLoPlays + u.predPlays) < 3) {
    flags.push("Faucet Farmeo sin jugar");
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
  const totalPlayCount = u.hiLoPlays + u.predPlays;
  if (u.balance > 5000 && u.totalDeposito === 0 && totalPlayCount < 5) {
    flags.push("Balance alto sin actividad en juegos");
  }

  // Many referrals but no own activity
  if (u.referralCount > 5 && totalPlayCount < 5 && u.faucetClaims < 10) {
    flags.push("Muchos referidos, nula actividad propia");
  }

  // Very new account with lots of faucet claims (rapid farming)
  if (u.daysRegistered <= 1 && u.faucetClaims > 15) {
    flags.push("Farming intensivo primer día");
  }

  if (flags.length === 0) return { status: "normal", flags };
  if (flags.length >= 3) return { status: "evaluar", flags };
  return { status: "evaluar", flags };
}

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const supabase = await createClient();

  // Intentamos obtener perfiles con last_ip
  let profilesRes: any = await supabase
    .from("profiles")
    .select("id, public_id, email, name, created_at, email_verified_at, status, last_ip")
    .order("created_at", { ascending: false })
    .limit(200);

  let migrationWarning = null;
  if (profilesRes.error && (profilesRes.error.message.includes("last_ip") || profilesRes.error.code === "PGRST204" || profilesRes.error.message.includes("does not exist"))) {
    // Si la columna no existe, reintentamos sin ella
    profilesRes = await supabase
      .from("profiles")
      .select("id, public_id, email, name, created_at, email_verified_at, status")
      .order("created_at", { ascending: false })
      .limit(200);
    migrationWarning = "La columna 'last_ip' no existe en la DB. Por favor ejecuta la migración 016 o créala manualmente.";
  }

  const [balancesRes, movementsRes, faucetMovsRes, betsRes, referralsRes, sessionIpsRes, allGlobalMovementsRes] = await Promise.all([
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
      .select("user_id, type, points, reference, metadata")
      .in("type", ["apuesta_hi_lo", "apuesta_prediccion"]),
    supabase.from("referrals").select("referrer_id"),
    supabase.from("session_ips").select("user_id, ip_hash"),
    supabase.from("movements").select("user_id, type, points").in("type", ["faucet", "apuesta_hi_lo", "apuesta_prediccion", "logro", "recompensa", "comision_afiliado", "bonus_referido_verificado", "premio_ranking"]),
  ]);

  const profiles = profilesRes.data ?? [];
  const dbError = profilesRes.error ? `Error DB: ${profilesRes.error.message}` : migrationWarning;
  const balanceByUser: Record<string, number> = {};
  (balancesRes.data ?? []).forEach((b) => {
    balanceByUser[b.user_id] = Number(b.points) || 0;
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

  // Process Game Bets (Hi-Lo and Predictions)
  const hiLoPlays: Record<string, number> = {};
  const hiLoAmount: Record<string, number> = {};
  const predPlays: Record<string, number> = {};
  const predAmount: Record<string, number> = {};

  (betsRes.data ?? []).forEach((m) => {
    const uid = m.user_id;
    const pts = Math.abs(Number(m.points) || 0);

    if (m.type === "apuesta_hi_lo") {
      const isRollup = m.reference?.startsWith("agrupacion_");
      let count = 1;
      if (isRollup && m.metadata && typeof m.metadata === "object") {
        count = Number((m.metadata as any).rollup_count || 1);
      }
      hiLoPlays[uid] = (hiLoPlays[uid] ?? 0) + count;
      hiLoAmount[uid] = (hiLoAmount[uid] ?? 0) + pts;
    } else if (m.type === "apuesta_prediccion") {
      predPlays[uid] = (predPlays[uid] ?? 0) + 1;
      predAmount[uid] = (predAmount[uid] ?? 0) + pts;
    }
  });
  // 1. Process Referral Earnings & Global Statistics (from 8th Promise result)
  const referralEarningsByUser: Record<string, number> = {};
  const globalUserEarnings: Record<string, number> = {};
  const allMixedMovements = allGlobalMovementsRes.data ?? []; 
  
  (allMixedMovements || []).forEach((m: any) => {
    const uid = m.user_id;
    const pts = Math.abs(Number(m.points) || 0);
    globalUserEarnings[uid] = (globalUserEarnings[uid] ?? 0) + pts;
    if (m.type === "comision_afiliado" || m.type === "bonus_referido_verificado") {
      referralEarningsByUser[uid] = (referralEarningsByUser[uid] ?? 0) + pts;
    }
  });

  const rankingSorted = Object.entries(globalUserEarnings).sort((a, b) => b[1] - a[1]);
  const userRankMap: Record<string, number> = {};
  rankingSorted.forEach(([id], index) => { userRankMap[id] = index + 1; });

  // 2. Count referrals per referrer
  const referralsByUser: Record<string, number> = {};
  (referralsRes.data ?? []).forEach((r) => {
    referralsByUser[r.referrer_id] = (referralsByUser[r.referrer_id] ?? 0) + 1;
  });

  // 3. IP Analysis
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

  // 4. Final Mapping
  const now = new Date();
  const users: UserRow[] = profiles.map((p: any) => {
    const daysRegistered = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / (24 * 60 * 60 * 1000));
    const faucetClaims = faucetByUser[p.id] ?? 0;
    const balance = balanceByUser[p.id] ?? 0;
    const totalDeposito = depositoByUser[p.id] ?? 0;
    const sameIpUsers = getMaxSharedIp(p.id);
    const referralCount = referralsByUser[p.id] ?? 0;
    const referralEarnings = referralEarningsByUser[p.id] ?? 0;
    const emailVerified = !!p.email_verified_at;

    const hp = hiLoPlays[p.id] ?? 0;
    const pp = predPlays[p.id] ?? 0;

    const auto = computeAutoStatus({
      emailVerified, faucetClaims, hiLoPlays: hp, predPlays: pp, daysRegistered,
      balance, totalDeposito, sameIpUsers, referralCount,
    });

    const dbStatus = (p.status as UserStatus) || "normal";
    const effectiveStatus = dbStatus !== "normal" ? dbStatus : auto.status;
    const level = getUserLevel({ betCount: hp + pp, faucetClaims, predictionCount: pp, daysSinceJoined: daysRegistered ?? 0, emailVerified });

    return {
      id: p.id,
      public_id: p.public_id ?? null,
      email: p.email,
      name: p.name,
      created_at: p.created_at,
      balance,
      totalDeposito,
      totalRetiro: retiroByUser[p.id] ?? 0,
      emailVerified,
      faucetClaims,
      daysRegistered,
      referralCount,
      referralEarnings,
      sameIpUsers,
      lastIp: (p as any).last_ip ?? null,
      status: effectiveStatus,
      autoStatus: auto.status,
      flags: auto.flags,
      level: { level: level.level, name: level.name, icon: level.icon, color: level.color },
      hiLoPlays: hp,
      hiLoAmount: hiLoAmount[p.id] ?? 0,
      predPlays: pp,
      predAmount: predAmount[p.id] ?? 0,
      rankingPos: userRankMap[p.id] ?? null,
    };
  });


  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Usuarios</h2>
      <AdminUsuariosTable users={users} dbError={dbError} />
    </div>
  );
}
