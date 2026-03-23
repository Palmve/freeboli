import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminUser } from "@/lib/current-user";

/**
 * POST /api/admin/db-maintenance
 * Ejecuta tareas de mantenimiento de la base de datos:
 * - Purgar registros viejos de rate_limit_log
 * - Limpiar security_events de más de 90 días
 * - Eliminar retiros rechazados de más de 30 días
 * - Corregir balances incoherentes (auditoría)
 * Solo accesible por administradores.
 */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { task } = body as { task: string };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Array<{ task: string; status: string; detail: string }> = [];

  // ------------------------------------------------------
  // TAREA 1: Limpiar rate_limit_log > 7 días
  // ------------------------------------------------------
  if (!task || task === "rate_limit_log") {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error, count } = await supabase
        .from("rate_limit_log")
        .delete({ count: "exact" })
        .lt("created_at", cutoff);
      results.push({
        task: "Purgar rate_limit_log (> 7 días)",
        status: error ? "ERROR" : "OK",
        detail: error ? error.message : `${count ?? "??"} registros eliminados`,
      });
    } catch (e: any) {
      results.push({ task: "Purgar rate_limit_log", status: "SKIP", detail: "Tabla no existente todavía" });
    }
  }

  // ------------------------------------------------------
  // TAREA 2: Limpiar security_events > 90 días
  // ------------------------------------------------------
  if (!task || task === "security_events") {
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { error, count } = await supabase
        .from("security_events")
        .delete({ count: "exact" })
        .lt("created_at", cutoff);
      results.push({
        task: "Purgar security_events (> 90 días)",
        status: error ? "ERROR" : "OK",
        detail: error ? error.message : `${count ?? "??"} eventos eliminados`,
      });
    } catch (e: any) {
      results.push({ task: "Purgar security_events", status: "SKIP", detail: "Tabla no existente todavía" });
    }
  }

  // ------------------------------------------------------
  // TAREA 3: Eliminar retiros rechazados > 30 días
  // ------------------------------------------------------
  if (!task || task === "rejected_withdrawals") {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error, count } = await supabase
        .from("withdrawals")
        .delete({ count: "exact" })
        .eq("status", "rejected")
        .lt("created_at", cutoff);
      results.push({
        task: "Eliminar retiros rechazados (> 30 días)",
        status: error ? "ERROR" : "OK",
        detail: error ? error.message : `${count ?? "??"} retiros eliminados`,
      });
    } catch (e: any) {
      results.push({ task: "Eliminar retiros rechazados", status: "ERROR", detail: e.message });
    }
  }

  // ------------------------------------------------------
  // TAREA 4: Auditoría de balances incoherentes
  // Detectar usuarios con balance negativo (nunca debe ocurrir)
  // ------------------------------------------------------
  if (!task || task === "audit_balances") {
    try {
      const { data: negBalances, error } = await supabase
        .from("balances")
        .select("user_id, points")
        .lt("points", 0);

      if (error) throw error;

      const count = negBalances?.length ?? 0;
      let detail = `${count} usuarios con balance negativo`;
      if (count > 0) {
        detail += ": " + (negBalances!.map(b => `${b.user_id} (${b.points})`).join(", "));
      }

      results.push({
        task: "Auditoría de balances negativos",
        status: count > 0 ? "ALERTA" : "OK",
        detail,
      });
    } catch (e: any) {
      results.push({ task: "Auditoría balances", status: "ERROR", detail: e.message });
    }
  }

  // ------------------------------------------------------
  // TAREA 5: Auditoría depósitos huérfanos
  // Depósitos con status != completed que llevan más de 48h
  // ------------------------------------------------------
  if (!task || task === "orphan_deposits") {
    try {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("deposit_wallets")
        .select("id, user_id, pending_amount, created_at")
        .gt("pending_amount", 0)
        .lt("created_at", cutoff);

      if (error) throw error;
      const count = data?.length ?? 0;
      results.push({
        task: "Depósitos huérfanos (> 48h pendientes)",
        status: count > 0 ? "ALERTA" : "OK",
        detail: count > 0
          ? `${count} depósitos sin procesar: revisar manualmente`
          : "Sin depósitos huérfanos",
      });
    } catch (e: any) {
      results.push({ task: "Auditoría depósitos huérfanos", status: "ERROR", detail: e.message });
    }
  }

  return NextResponse.json({
    ok: true,
    executed_by: admin.email,
    executed_at: new Date().toISOString(),
    results,
  });
}
