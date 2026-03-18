-- ============================================================
-- 004_rewards_streaks.sql
-- Extends faucet_claims for streaks/captcha,
-- creates site_settings table,
-- seeds reward_templates (achievements + referral bonus)
-- ============================================================

-- 1. Extend faucet_claims with streak and captcha tracking columns
ALTER TABLE public.faucet_claims
  ADD COLUMN IF NOT EXISTS hourly_streak INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_streak INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_date DATE,
  ADD COLUMN IF NOT EXISTS claims_since_captcha INT DEFAULT 0;

-- 2. Site-wide configurable settings (key-value, admin-editable)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Seed reward templates (achievements)
INSERT INTO public.reward_templates (code, name, description, points_reward) VALUES
  ('email_verified',     'Verificar correo',            'Verifica tu correo electrónico',                        500),
  ('first_bet',          'Primera apuesta',             'Haz tu primera apuesta en HI-LO',                      200),
  ('bets_100',           '100 apuestas',                'Realiza 100 apuestas en HI-LO',                        500),
  ('bets_1000',          '1000 apuestas',               'Realiza 1,000 apuestas en HI-LO',                     2000),
  ('bets_10000',         '10000 apuestas',              'Realiza 10,000 apuestas en HI-LO',                   10000),
  ('first_referral',     'Primer referido verificado',  'Invita a tu primer amigo que verifique su email',      1000),
  ('referral_verified',  'Bonus referido verificado',   'Bonus por cada referido que verifica su email',       10000)
ON CONFLICT (code) DO NOTHING;

-- 4. Seed default site settings
INSERT INTO public.site_settings (key, value) VALUES
  ('FAUCET_POINTS',                 '100'),
  ('FAUCET_COOLDOWN_HOURS',         '1'),
  ('AFFILIATE_COMMISSION_PERCENT',  '50'),
  ('AFFILIATE_ACHIEVEMENT_PERCENT', '10'),
  ('REFERRAL_VERIFIED_BONUS',       '10000'),
  ('CAPTCHA_INTERVAL',              '4'),
  ('HOURLY_STREAK_TIERS',           '[{"min":1,"max":3,"multiplier":1},{"min":4,"max":6,"multiplier":1.5},{"min":7,"max":12,"multiplier":2},{"min":13,"max":24,"multiplier":2.5},{"min":25,"max":999999,"multiplier":3}]'),
  ('DAILY_STREAK_TIERS',            '[{"min":1,"max":1,"bonus":0},{"min":2,"max":3,"bonus":0.10},{"min":4,"max":7,"bonus":0.25},{"min":8,"max":14,"bonus":0.50},{"min":15,"max":30,"bonus":0.75},{"min":31,"max":999999,"bonus":1.0}]')
ON CONFLICT (key) DO NOTHING;
