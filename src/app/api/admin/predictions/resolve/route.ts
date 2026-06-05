import { NextResponse } from "next/server";
import { resolvePendingRounds, ensureActiveRound } from "@/lib/predictions";
import { getAdminUser } from "@/lib/current-user";

export async function POST() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const resolvedCount = await resolvePendingRounds();
    
    // Asegurar rondas activas (MICRO eliminado; BOLIS ya no es objeto de predicción).
    const types: ("hourly"| "mini")[] = ["hourly", "mini"];
    for (const asset of (["BTC", "SOL"] as const)) {
        for (const type of types) {
           await ensureActiveRound(asset, type).catch(() => {});
        }
    }

    return NextResponse.json({ 
      success: true, 
      resolved: resolvedCount 
    });
  } catch (error) {
    console.error("Manual Resolve Error:", error);
    return NextResponse.json({ error: "Error al procesar" }, { status: 500 });
  }
}
