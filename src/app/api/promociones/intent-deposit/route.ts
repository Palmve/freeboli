import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { promoId } = body;
    
    if (!promoId) {
      return NextResponse.json({ error: "Missing promoId" }, { status: 400 });
    }

    // UPSERT intent
    const { error } = await supabase
      .from("pending_promo_deposits")
      .upsert({ 
        user_id: (session.user as any).id, 
        promo_id: promoId,
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw error;
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[intent-deposit] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
