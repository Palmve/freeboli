import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/current-user";
import { getTreasuryBalance } from "@/lib/solana";

export async function GET() {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const balance = await getTreasuryBalance();
  return NextResponse.json(balance);
}
