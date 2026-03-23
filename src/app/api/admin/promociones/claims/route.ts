import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const promoId = searchParams.get("promoId");

    if (!promoId) {
      return NextResponse.json({ error: "PromoId required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("promociones_claims")
      .select(`
        *,
        profiles:user_id (id, email, name)
      `)
      .eq("promo_id", promoId)
      .order("claimed_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ claims: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
