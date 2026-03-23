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

    const body = await req.json();
    const rawWord = body.word || "";

    if (!rawWord || typeof rawWord !== 'string') {
      return NextResponse.json({ error: "Palabra requerida" }, { status: 400 });
    }

    // Sanitización: Limitar longitud, trim, y evitar caracteres sospechosos
    const word = rawWord.trim().substring(0, 50).replace(/[<>'"%;()]/g, "");

    // TODO: Implementar un rate limit más robusto (ej: Redis o tabla en DB)
    // Por ahora, validamos la palabra sanitizada en la RPC
    
    // Llamar a la función RPC atómica para máxima seguridad
    const { data, error } = await supabase.rpc('fn_claim_promotion', {
      p_user_id: session.user.id,
      p_word: word
    });

    if (error) throw error;

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: data.message,
      points: data.points,
      promo_name: data.promo_name
    });

  } catch (error: any) {
    console.error("Error claiming promo:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
