import { NextResponse } from "next/server";
import { resolvePendingRounds, ensureActiveRound } from "@/lib/predictions";
import { getAdminUser } from "@/lib/current-user";

export async function POST() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const resolvedCount = await resolvePendingRounds();
    
    // Asegurar rondas activas por si acaso (todas las modalidades)
    const types: ("hourly"| "mini" | "micro")[] = ["hourly", "mini", "micro"];
    for (const asset of (["BTC", "SOL", "BOLIS"] as const)) {
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
