-- ════════════════════════════════════════════════════════════════════════════
-- Migración 040 — LOCKDOWN RLS (Vuln 1 / CRÍTICA)
-- ════════════════════════════════════════════════════════════════════════════
--
-- PROBLEMA:
--   La app autentica con NextAuth (JWT propio), NO con Supabase Auth, por lo que
--   auth.uid() siempre es NULL para el rol `anon`. Las tablas financieras y de PII
--   (profiles, balances, movements, withdrawals, faucet_claims, prediction_bets, …)
--   estaban SIN RLS y con los GRANT por defecto de Supabase al rol `anon`.
--   Como la anon key es pública (se incrusta en el bundle del navegador vía
--   NEXT_PUBLIC_SUPABASE_ANON_KEY), CUALQUIER visitante podía hablar directo con
--   PostgREST y:
--     - UPDATE balances SET points = 100000000 WHERE user_id = <propio>  (robo)
--     - SELECT email, password_hash, last_ip FROM profiles               (fuga PII)
--     - UPDATE profiles SET is_admin = true                              (escalada)
--   saltándose por completo la validación del backend.
--
-- ESTRATEGIA — "denegar por defecto":
--   Se habilita RLS (sin políticas => deny-all para anon/authenticated) y se revoca
--   el acceso directo de esos roles en TODAS las tablas de `public`, EXCEPTO
--   `analytics_events` (la consume el dashboard /admin/visitas en tiempo real con la
--   anon key del navegador; solo necesita SELECT).
--
--   El backend accede con SUPABASE_SERVICE_ROLE_KEY, que tiene BYPASSRLS y NO se ve
--   afectado por estos cambios. La autorización por usuario se aplica en el código
--   (siempre se filtra por el userId derivado de la sesión NextAuth).
--
-- ⚠️ ORDEN DE DESPLIEGUE (IMPORTANTE — es el INVERSO del habitual):
--   1) Desplegar PRIMERO el código de esta rama (src/lib/supabase/server.ts pasa a
--      usar la service role key). El código nuevo funciona con o sin RLS.
--   2) Ejecutar DESPUÉS esta migración en el SQL Editor del proyecto de producción
--      (tiyjxmyknpgefjslkkrc).
--   Si se ejecuta la migración ANTES del deploy, el código viejo (anon key) perderá
--   acceso a las tablas y el sitio fallará hasta que entre el deploy.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  -- Tablas que DEBEN seguir accesibles por la anon key del navegador.
  allowlist TEXT[] := ARRAY['analytics_events'];
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> ALL (allowlist)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', r.tablename);
  END LOOP;
END $$;

-- Evita que tablas creadas en el futuro hereden privilegios para anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- analytics_events: el dashboard en tiempo real (/admin/visitas) lo lee con la anon
-- key del navegador, así que conserva SOLO lectura. Las inserciones las hace el
-- backend con service role (/api/analytics/track), por lo que anon NO necesita INSERT.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.analytics_events FROM anon, authenticated;
GRANT SELECT ON public.analytics_events TO anon, authenticated;

-- ── Verificación post-aplicación (ejecutar manualmente; debe devolver 0 filas) ──
-- Tablas de public que sigan SIN RLS (excepto analytics_events):
--   SELECT tablename FROM pg_tables
--   WHERE schemaname='public' AND tablename <> 'analytics_events' AND rowsecurity = false;
--
-- Prueba con la ANON key (debe dar 401/permission denied, NO datos):
--   curl "$URL/rest/v1/balances?select=points&limit=1" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
