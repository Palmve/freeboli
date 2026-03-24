-- 027_level_limits_reward_points.sql
-- Premio en puntos al alcanzar cada nivel (editable en Admin → Configuración → Niveles).
-- Se guarda dentro de site_settings.LEVEL_LIMITS por nivel, p. ej. "4": { "rewardPoints": 1000, "maxBet": ... }.
-- Valores por defecto alineados con src/lib/levels.ts (LEVELS[].rewardPoints).

DO $$
DECLARE
  merged jsonb := '{}'::jsonb;
  lvl int;
  defaults int[] := ARRAY[0, 0, 0, 1000, 5000, 10000, 25000];
  existing jsonb;
BEGIN
  SELECT value INTO existing FROM public.site_settings WHERE key = 'LEVEL_LIMITS';
  IF existing IS NOT NULL THEN
    merged := existing;
  END IF;

  FOR lvl IN 1..7 LOOP
    merged := jsonb_set(
      merged,
      ARRAY[lvl::text, 'rewardPoints'],
      to_jsonb(defaults[lvl]),
      true
    );
  END LOOP;

  INSERT INTO public.site_settings (key, value, updated_at)
  VALUES ('LEVEL_LIMITS', merged, now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
END $$;
