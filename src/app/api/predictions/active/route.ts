import { NextResponse } from "next/server";
import { getActiveRoundWithOdds, PredictionAsset, resolvePendingRounds } from "@/lib/predictions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset")?.toUpperCase() as PredictionAsset) || "BTC";
  const type = (searchParams.get("type") as any) === "mini" ? "mini" : "hourly";

  if (asset !== "BTC" && asset !== "SOL" && asset !== "BOLIS") {
    return NextResponse.json({ error: "Asset no soportado." }, { status: 400 });
  }

  // Sustituye el cron de resolución: liquidar rondas vencidas “bajo demanda” (en segundo plano)
  resolvePendingRounds().catch((e) => console.error("Lazy resolve error:", e));

  const data: any = await getActiveRoundWithOdds(asset, type);
  if (data?.error) {
    return NextResponse.json({ error: data.error }, { status: 404 });
  }

  return NextResponse.json(data);
}
