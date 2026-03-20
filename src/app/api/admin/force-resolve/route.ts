import { NextResponse } from "next/server";
import { resolvePendingRounds } from "@/lib/predictions";

export async function GET() {
    try {
        const count = await resolvePendingRounds();
        return NextResponse.json({ success: true, resolved_count: count });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
