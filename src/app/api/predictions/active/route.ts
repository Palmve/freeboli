import { NextResponse } from "next/server";
import { getActiveRoundWithOdds, PredictionAsset } from "@/lib/predictions";

const VALID_ASSETS = ["BTC", "SOL", "BOLIS"] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawAsset = searchParams.get("asset")?.toUpperCase();
  const tParam = searchParams.get("type");
  const type = (tParam === "mini" || tParam === "micro") ? tParam : "hourly";

  if (!rawAsset || !VALID_ASSETS.includes(rawAsset as any)) {
    return NextResponse.json({ error: "Asset no soportado." }, { status: 400 });
  }
  const asset = rawAsset as PredictionAsset;

  // La resolución de rondas la maneja el cron master (/api/cron/master).
  // Se elimina resolvePendingRounds() de este endpoint público para evitar
  // que usuarios sin autenticar disparen resoluciones y como protección DoS.

  const data: any = await getActiveRoundWithOdds(asset, type);
  if (data?.error) {
    return NextResponse.json({ error: data.error }, { status: 404 });
  }

  // === Inyectar estado de pausa ===
  const { getSetting } = await import("@/lib/site-settings");
  const pauseKey = `PAUSE_GAME_${asset}_${type.toUpperCase()}`;
  data.is_paused = (await getSetting<number>(pauseKey, 0)) === 1;

  return NextResponse.json(data);
}
