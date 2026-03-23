import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isSuperAdmin(email: string) {
  // Unificar con la variable pública o privada según disponibilidad
  const adminString = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
  const admins = adminString.split(",").map(e => e.trim().toLowerCase());
  return admins[0] === email.toLowerCase();
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isSuperAdmin(session.user.email))) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("staff_access_nodes")
      .select("*, profiles!inner(email, name)");

    if (error) throw error;
    return NextResponse.json({ staff: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isSuperAdmin(session.user.email))) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { userId: inputId, permissions } = await req.json();
    if (!inputId) return NextResponse.json({ error: "Falta identificador" }, { status: 400 });

    let finalUserId = inputId;

    // Si parece un email, buscar el ID en profiles
    if (inputId.includes("@")) {
      const { data: profile, error: pError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", inputId.toLowerCase())
        .single();
      
      if (pError || !profile) {
        return NextResponse.json({ error: "Usuario no encontrado con ese email." }, { status: 404 });
      }
      finalUserId = profile.id;
    }

    const { data, error } = await supabase
      .from("staff_access_nodes")
      .upsert({ 
        user_id: finalUserId, 
        permissions: permissions || { promotions: true },
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
       console.error("Error adding staff:", error);
       return NextResponse.json({ 
         error: `Error de base de datos: ${error.message}`,
         details: error.details,
         hint: error.hint
       }, { status: 400 });
    }

    return NextResponse.json({ ok: true, staff: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isSuperAdmin(session.user.email))) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

    const { error } = await supabase
      .from("staff_access_nodes")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
