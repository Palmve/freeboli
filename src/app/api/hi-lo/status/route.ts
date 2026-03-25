import { NextResponse } from "next/server";
import { getSetting } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const isPaused = await getSetting<number>("PAUSE_GAME_HI_LO", 0);
    return NextResponse.json({ is_paused: isPaused === 1 });
  } catch (e) {
    return NextResponse.json({ is_paused: false });
  }
}
