import { NextResponse } from "next/server";
import { getActiveRoundWithOdds, PredictionAsset } from "@/lib/predictions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset")?.toUpperCase() as PredictionAsset) || "BTC";

  if (asset !== "BTC" && asset !== "SOL" && asset !== "BOLIS") {
    return NextResponse.json({ error: "Asset no soportado." }, { status: 400 });
  }

  const data = await getActiveRoundWithOdds(asset);
  if (!data) {
    return NextResponse.json({ error: "No hay rondas activas." }, { status: 404 });
  }

  return NextResponse.json(data);
}
