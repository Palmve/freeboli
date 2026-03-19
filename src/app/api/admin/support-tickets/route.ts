import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/current-user";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const supabase = await createClient();
  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }

  return NextResponse.json({ tickets });
}
