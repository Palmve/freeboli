-- 006: Leaderboard prize awards tracking

CREATE TABLE IF NOT EXISTS public.prize_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  period_key TEXT NOT NULL,
  rank INT NOT NULL,
  points INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period, period_key)
);

CREATE INDEX IF NOT EXISTS idx_prize_awards_user ON public.prize_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_prize_awards_period ON public.prize_awards(period, period_key);

-- Default prize settings
INSERT INTO public.site_settings (key, value) VALUES
  ('PRIZE_DAILY_1', '500'),
  ('PRIZE_DAILY_2', '300'),
  ('PRIZE_DAILY_3', '100'),
  ('PRIZE_WEEKLY_1', '5000'),
  ('PRIZE_WEEKLY_2', '3000'),
  ('PRIZE_WEEKLY_3', '1000'),
  ('PRIZE_MONTHLY_1', '25000'),
  ('PRIZE_MONTHLY_2', '15000'),
  ('PRIZE_MONTHLY_3', '5000')
ON CONFLICT (key) DO NOTHING;
