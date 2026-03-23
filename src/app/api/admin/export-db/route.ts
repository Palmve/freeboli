import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/lib/current-user";

/**
 * GET /api/admin/export-db
 * Exporta las tablas principales de la base de datos como JSON para respaldo local
 * y análisis forense. Solo accesible por administradores.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Tablas a exportar (las más relevantes para análisis)
  const tables = [
    "profiles",
    "movements",
    "withdrawals",
    "referrals",
    "hilo_bets",
    "faucet_tracker",
    "deposit_wallets",
    "predictions",
    "prediction_bets",
    "user_rewards",
    "security_events",
    "withdrawal_anomalies",
    "rate_limit_log",
  ];

  const exportData: Record<string, unknown[]> = {};
  const errors: string[] = [];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10000); // Máximo 10k filas por tabla

      if (error) {
        errors.push(`${table}: ${error.message}`);
        exportData[table] = [];
      } else {
        exportData[table] = data ?? [];
      }
    } catch (err: any) {
      errors.push(`${table}: ${err?.message ?? "Error desconocido"}`);
      exportData[table] = [];
    }
  }

  // Sanitizar: eliminar campos sensibles antes de la descarga
  if (exportData["profiles"]) {
    exportData["profiles"] = (exportData["profiles"] as any[]).map((p) => {
      // Eliminar campos sensibles de la exportación
      const { password_hash, ...safe } = p;
      return safe;
    });
  }

  // Eliminar encrypted_private_key de deposit_wallets
  if (exportData["deposit_wallets"]) {
    exportData["deposit_wallets"] = (exportData["deposit_wallets"] as any[]).map((w) => {
      const { encrypted_private_key, ...safe } = w;
      return { ...safe, has_encrypted_key: !!encrypted_private_key };
    });
  }

  const exportPayload = {
    exported_at: new Date().toISOString(),
    exported_by: admin.email,
    tables_count: tables.length,
    errors: errors.length > 0 ? errors : undefined,
    data: exportData,
  };

  // Generar como descarga JSON
  const jsonContent = JSON.stringify(exportPayload, null, 2);

  return new NextResponse(jsonContent, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="freeboli_backup_${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
