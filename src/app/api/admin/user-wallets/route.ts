import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/lib/current-user";
import { getWalletBolisBalance } from "@/lib/solana";

export async function GET() {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: wallets, error } = await supabase
    .from("deposit_wallets")
    .select("user_id, public_key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!wallets || wallets.length === 0) {
    return NextResponse.json({ wallets: [], totalBolis: 0 });
  }

  const userIds = wallets.map((w) => w.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, name")
    .in("id", userIds);

  const profileMap: Record<string, { email: string; name: string | null }> = {};
  (profiles ?? []).forEach((p) => {
    profileMap[p.id] = { email: p.email, name: p.name };
  });

  const results = await Promise.all(
    wallets.map(async (w) => {
      let bolisBalance = 0;
      try {
        bolisBalance = await getWalletBolisBalance(w.public_key);
      } catch {
        // RPC error — report 0
      }
      const profile = profileMap[w.user_id];
      return {
        userId: w.user_id,
        email: profile?.email ?? "—",
        name: profile?.name ?? null,
        address: w.public_key,
        bolisBalance,
      };
    })
  );

  const totalBolis = results.reduce((sum, r) => sum + r.bolisBalance, 0);

  return NextResponse.json({ wallets: results, totalBolis });
}
