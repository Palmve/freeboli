import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
    const supabase = createAdminClient();
    const now = new Date();
    
    const { data: allPending } = await supabase
        .from("prediction_rounds")
        .select("*")
        .neq("status", "resolved")
        .neq("status", "cancelled");

    const filtered = allPending?.filter(r => new Date(r.end_time) < now);

    return NextResponse.json({ 
        now: now.toISOString(),
        all_pending_status: allPending?.length || 0,
        expired_count: filtered?.length || 0,
        expired_samples: filtered?.slice(0, 3)
    });
}
