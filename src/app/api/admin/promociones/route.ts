import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const user = await getAdminUser("promotions");
    if (!user) {
      return NextResponse.json({ error: "No autorizado o dispositivo no verificado." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("promociones")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ promotions: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAdminUser("promotions");
    if (!user) {
      return NextResponse.json({ error: "No autorizado o dispositivo no verificado." }, { status: 403 });
    }

    const body = await req.json();
    const { id, nombre, nombre_en, palabra, puntos_totales, puntos_restantes, puntos_por_usuario, link_fuente, is_active } = body;

    if (id) {
      // Update
      const { data, error } = await supabase
        .from("promociones")
        .update({ nombre, nombre_en, palabra, puntos_totales, puntos_restantes, puntos_por_usuario, link_fuente, is_active })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ promotion: data });
    } else {
      // Create
      const { data, error } = await supabase
        .from("promociones")
        .insert({ 
          nombre, 
          nombre_en,
          palabra, 
          puntos_totales, 
          puntos_restantes: puntos_totales, 
          puntos_por_usuario, 
          link_fuente, 
          is_active: true 
        })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ promotion: data });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
