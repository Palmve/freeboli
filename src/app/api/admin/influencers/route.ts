import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 
 * GET /api/admin/influencers
 * Lista los influencers con sus estadísticas agregadas.
 */
export async function GET() {
  const user = await getAdminUser("promotions");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const supabase = await createClient();

  // 1. Obtener configuraciones de influencers
  const { data: configs, error: configError } = await supabase
    .from("influencer_configs")
    .select(`
      *,
      profiles:user_id (email, name, public_id)
    `)
    .order("created_at", { ascending: false });

  if (configError) return NextResponse.json({ error: configError.message }, { status: 500 });

  // 2. Obtener estadísticas agregadas para cada influencer
  // En una app más grande esto sería una vista o una query más compleja.
  const influencersWithStats = await Promise.all((configs || []).map(async (cfg) => {
    const userId = cfg.user_id;

    // Conteo de referidos totales
    const { count: referralCount } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", userId);

    // Suma de bonos de influencer
    const { data: bountySum } = await supabase
      .from("movements")
      .select("points.sum()")
      .eq("user_id", userId)
      .eq("type", "influencer_bounty");

    // Suma de comisiones de afiliado normales (para reporte completo)
    const { data: commSum } = await supabase
      .from("movements")
      .select("points.sum()")
      .eq("user_id", userId)
      .eq("type", "comision_afiliado");

    const totalBounty = (bountySum?.[0] as any)?.sum || 0;
    const totalComission = (commSum?.[0] as any)?.sum || 0;

    return {
      ...cfg,
      stats: {
        referrals: referralCount || 0,
        bounty_points: totalBounty,
        total_earned: totalBounty + totalComission
      }
    };
  }));

  return NextResponse.json(influencersWithStats);
}

/**
 * POST /api/admin/influencers
 * Crea o actualiza la configuración de un influencer.
 */
export async function POST(req: Request) {
  const user = await getAdminUser("promotions");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { userId: reqUserId, email: reqEmail, bounty, maxAmount, maxDaily, autoApprove, isActive } = body;

  // Validación estricta de rangos (anti-manipulación)
  const safeBounty = Math.max(0, Math.min(Math.round(Number(bounty) || 0), 100000)); // 0-100 Bolis máx
  const safeMaxAmount = Math.max(0, Math.min(Math.round(Number(maxAmount) || 500000), 5000000)); // 0-5000 Bolis máx
  const safeMaxDaily = Math.max(1, Math.min(Math.round(Number(maxDaily) || 3), 10)); // 1-10 retiros/día

  const supabase = await createClient();
  let targetUserId = reqUserId;

  // Si envían email, buscar el UUID
  if (!targetUserId && reqEmail) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", reqEmail.trim().toLowerCase())
      .single();
    if (!profile) return NextResponse.json({ error: "No se encontró ningún usuario con ese correo." }, { status: 404 });
    targetUserId = profile.id;
  }

  if (!targetUserId) return NextResponse.json({ error: "userId o email es requerido" }, { status: 400 });

  const { data, error } = await supabase
    .from("influencer_configs")
    .upsert({
      user_id: targetUserId,
      bounty_per_confirmed_user: safeBounty,
      max_withdrawal_amount: safeMaxAmount,
      max_daily_withdrawals: safeMaxDaily,
      auto_approve_withdrawals: autoApprove === true || autoApprove === "true",
      is_active: isActive !== false && isActive !== "false",
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
