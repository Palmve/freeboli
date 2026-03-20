import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { generateBotWallet } from "@/lib/bot-engine";

export async function POST() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const wallet = await generateBotWallet("Auto-Generated via Admin");
    return NextResponse.json(wallet);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
