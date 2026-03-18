-- 007: Terms acceptance and game limits

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Default game limit settings
INSERT INTO public.site_settings (key, value) VALUES
  ('MAX_BET_POINTS', '1000000'),
  ('MAX_WIN_POINTS', '1000000'),
  ('MAX_DAILY_WIN_POINTS', '2000000')
ON CONFLICT (key) DO NOTHING;
