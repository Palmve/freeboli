import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllSettings } from "@/lib/site-settings";
import { syncBotBalances } from "@/lib/bot-engine";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createAdminClient();
  
  // Sincronizar balances con la blockchain antes de mostrar
  await syncBotBalances().catch((e: any) => console.error("Sync error:", e));

  const [settings, { data: wallets }, { data: stats }] = await Promise.all([
    getAllSettings(),
    supabase.from("bot_wallets").select("*").order("created_at", { ascending: false }),
    supabase.rpc("get_bot_stats") // Usaré un RPC para eficiencia o un query manual
  ]);

  // Si el RPC falla (porque no se inyectó todavía), hacemos un fallback de query
  let finalStats = stats;
  if (!finalStats) {
      const { data: trades } = await supabase.from("bot_trades").select("pnl, fee");
      finalStats = {
          total_trades: trades?.length || 0,
          total_pnl: trades?.reduce((s,t) => s + Number(t.pnl || 0), 0) || 0,
          total_fees: trades?.reduce((s,t) => s + Number(t.fee || 0), 0) || 0,
      };
  }

  return NextResponse.json({ settings, wallets, stats: finalStats });
}
