import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getTreasuryBalance } from "@/lib/solana";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const balance = await getTreasuryBalance();
  return NextResponse.json(balance);
}
