import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para uso EXCLUSIVO en el servidor (route handlers y server
 * components).
 *
 * SEGURIDAD (Vuln 1 / migración 040_rls_lockdown):
 *   Usa la SERVICE ROLE KEY. Tras habilitar RLS, la anon key del navegador queda
 *   bloqueada para las tablas sensibles (saldos, profiles/password_hash, retiros…),
 *   así que TODO el acceso de datos del backend pasa por service role, que omite RLS.
 *   La app no usa Supabase Auth (auth.uid() es null); la autorización por usuario se
 *   aplica en el código filtrando SIEMPRE por el userId derivado de la sesión NextAuth.
 *
 *   No se usa el adaptador de cookies a propósito: así el bearer es siempre la service
 *   role key y no puede degradarse inyectando una cookie de sesión de Supabase.
 *
 * ⚠️ NUNCA importar este módulo desde un componente cliente. Para el navegador usar
 *    @/lib/supabase/client (anon key; solo lectura de analytics_events).
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
