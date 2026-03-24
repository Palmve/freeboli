import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("promociones")
      .select("id, nombre, nombre_en, puntos_totales, puntos_restantes, puntos_por_usuario, link_fuente")
      .eq("is_active", true)
      .gt("puntos_restantes", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ promo: null });
      throw error;
    }

    return NextResponse.json({ promo: data });
  } catch (error: any) {
    console.error("Error fetching active promo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
