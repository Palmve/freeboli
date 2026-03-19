-- 010_security_settings.sql
-- Parámetros de seguridad y antibot editables desde Admin → Configuración (grupo Seguridad).
-- Valores por defecto; no sobrescribir si ya existen (ON CONFLICT DO NOTHING).

INSERT INTO public.site_settings (key, value) VALUES
  ('MAX_SESSIONS_PER_IP',             '3'),
  ('REGISTER_BURST_MAX',              '3'),
  ('REGISTER_BURST_WINDOW_MINUTES',    '15'),
  ('REGISTER_DAILY_MAX',               '5'),
  ('REGISTER_DAILY_WINDOW_HOURS',      '24'),
  ('REGISTER_MIN_SECONDS',            '3'),
  ('ENABLE_DISPOSABLE_BLOCK',         '1'),
  ('WITHDRAW_RATE_MAX',               '5'),
  ('WITHDRAW_RATE_WINDOW_HOURS',      '1')
ON CONFLICT (key) DO NOTHING;
