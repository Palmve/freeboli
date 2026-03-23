import { createClient } from "@/lib/supabase/server";
import { getUserLevel } from "@/lib/levels";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserStatus } from "../page";
import StatusManager from "./StatusManager";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (profileError || !profile) {
    return notFound();
  }

  const [balanceRes, movementsRes, faucetMovsRes, betsRes, referralsRes, sessionIpsRes] = await Promise.all([
    supabase.from("balances").select("points").eq("user_id", id).single(),
    supabase.from("movements").select("type, points").eq("user_id", id).in("type", ["deposito_bolis", "retiro_bolis"]),
    supabase.from("movements").select("id", { count: "exact" }).eq("user_id", id).eq("type", "faucet"),
    supabase.from("movements").select("type, points, reference, metadata").eq("user_id", id).in("type", ["apuesta_hi_lo", "apuesta_prediccion"]),
    supabase.from("referrals").select("id", { count: "exact" }).eq("referrer_id", id),
    supabase.from("session_ips").select("ip_hash").eq("user_id", id),
  ]);

  const balance = balanceRes.data?.points ?? 0;
  const faucetClaims = faucetMovsRes.count ?? 0;
  const referralCount = referralsRes.count ?? 0;

  let totalDeposito = 0;
  let totalRetiro = 0;
  movementsRes.data?.forEach(m => {
    if (m.type === "deposito_bolis") totalDeposito += Number(m.points);
    else totalRetiro += Math.abs(Number(m.points));
  });

  let hiLoPlays = 0;
  let hiLoAmount = 0;
  let predPlays = 0;
  let predAmount = 0;

  betsRes.data?.forEach(m => {
    const pts = Math.abs(Number(m.points));
    if (m.type === "apuesta_hi_lo") {
      const isRollup = m.reference?.startsWith("agrupacion_");
      let count = 1;
      if (isRollup && m.metadata && typeof m.metadata === "object") {
        count = Number((m.metadata as any).rollup_count || 1);
      }
      hiLoPlays += count;
      hiLoAmount += pts;
    } else {
      predPlays += 1;
      predAmount += pts;
    }
  });

  const emailVerified = !!profile.email_verified_at;
  const daysRegistered = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (24 * 60 * 60 * 1000));
  const level = getUserLevel({ 
    betCount: hiLoPlays + predPlays, 
    faucetClaims, 
    predictionCount: predPlays, 
    daysSinceJoined: daysRegistered, 
    emailVerified 
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between">
        <Link href="/admin/usuarios" className="text-amber-400 hover:underline text-sm font-bold flex items-center gap-1">
          ← Volver a Usuarios
        </Link>
        <span className="text-[10px] text-slate-500 font-mono">UUID: {profile.id}</span>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              {profile.email} 
              <span className="text-xs bg-slate-700 px-2 py-1 rounded-full text-amber-400 font-mono">ID: {profile.public_id}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Registrado el {new Date(profile.created_at).toLocaleDateString()} ({daysRegistered} días)</p>
          </div>
          <div className="flex items-center gap-3">
             <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 ${level.color}`}>
                <span className="text-2xl">{level.icon}</span>
                <div>
                  <p className="text-[10px] uppercase font-black opacity-60">Nivel Actual</p>
                  <p className="font-bold">{level.name} (Nv.{level.level})</p>
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Columna Izquierda: Estados y Control */}
          <div className="md:col-span-1 space-y-6">
            <StatusManager userId={profile.id} currentStatus={profile.status as UserStatus} />
            
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Seguridad</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Email Verificado:</span>
                  <span className={emailVerified ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{emailVerified ? "SÍ" : "NO"}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Última IP:</span>
                  <span className="text-white font-mono">{profile.last_ip || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Estadísticas */}
          <div className="md:col-span-2 space-y-6">
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/30">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Balance Actual</p>
                  <p className="text-2xl font-mono font-bold text-white">{balance.toLocaleString()} <span className="text-xs font-normal text-slate-400">pts</span></p>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/30">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Faucet Claims</p>
                  <p className="text-2xl font-bold text-white">{faucetClaims}</p>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/30">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Total Depositado</p>
                  <p className="text-xl font-mono font-bold text-green-400">+{totalDeposito.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/30">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Total Retirado</p>
                  <p className="text-xl font-mono font-bold text-amber-500">-{totalRetiro.toLocaleString()}</p>
                </div>
             </div>

             <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-700/30">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Actividad en Juegos</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] text-sky-400 font-bold uppercase mb-2">Multiplicador HI-LO</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs"><span className="text-slate-500">Tiradas:</span> <span className="text-white font-bold">{hiLoPlays}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">Volumen:</span> <span className="text-white font-mono">{hiLoAmount.toLocaleString()} pts</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-400 font-bold uppercase mb-2">Predicciones</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs"><span className="text-slate-500">Apuestas:</span> <span className="text-white font-bold">{predPlays}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">Volumen:</span> <span className="text-white font-mono">{predAmount.toLocaleString()} pts</span></div>
                    </div>
                  </div>
                </div>
             </div>

             <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/30 flex justify-between items-center px-6">
               <div className="text-center">
                 <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Referidos</p>
                 <p className="text-xl font-bold text-white">{referralCount}</p>
               </div>
               <div className="h-10 w-px bg-slate-800"></div>
               <div className="text-center">
                 <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Ganancia por Refs</p>
                 <p className="text-xl font-bold text-green-400">??? pts</p>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
