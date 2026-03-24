import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Estado de intención de depósito al pozo (solo el usuario autenticado ve la suya). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row, error } = await supabase
      .from("pending_promo_deposits")
      .select(
        `
        promo_id,
        promociones ( nombre, nombre_en )
      `
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01" || error.message?.toLowerCase().includes("does not exist")) {
        return NextResponse.json({ pending: null });
      }
      throw error;
    }

    if (!row) {
      return NextResponse.json({ pending: null });
    }

    const promo = (row as { promociones?: { nombre?: string; nombre_en?: string } | null }).promociones;
    return NextResponse.json({
      pending: {
        promoId: row.promo_id,
        nombre: promo?.nombre ?? "",
        nombre_en: promo?.nombre_en ?? "",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    console.error("[pending-intent]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
