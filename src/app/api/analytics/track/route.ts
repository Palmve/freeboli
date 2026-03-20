import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(req: Request) {
  try {
    const { type, path, metadata: clientMetadata } = await req.json();
    const supabase = await createClient();
    
    // Obtener usuario de forma segura y rápida
    let user = null;
    try {
      user = await getCurrentUser();
    } catch {
      // Ignorar si hay problemas de sesión
    }

    // Extraer ubicación de headers (Vercel/Standard headers)
    const city = req.headers.get("x-vercel-ip-city") || "Localhost";
    const country = req.headers.get("x-vercel-ip-country") || "Local";
    const lat = req.headers.get("x-vercel-ip-latitude");
    const lon = req.headers.get("x-vercel-ip-longitude");
    const lang = req.headers.get("accept-language")?.split(",")[0] || "es";

    const serverMetadata = {
      city,
      country,
      lat: lat ? parseFloat(lat) : null,
      lon: lon ? parseFloat(lon) : null,
      lang,
      ua: req.headers.get("user-agent"),
    };

    const { error } = await supabase.from("analytics_events").insert({
      user_id: user?.id || null,
      type: type || "page_view",
      path: path || "/",
      metadata: { ...clientMetadata, ...serverMetadata },
    });

    if (error) {
        // Si la tabla no existe, fallará. 
        // En un entorno real, avisaríamos que ejecute el SQL.
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
