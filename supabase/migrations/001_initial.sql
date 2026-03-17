-- Usuarios (vinculados a NextAuth; id = auth.uid o email)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT,
  image TEXT,
  wallet_solana TEXT,
  password_hash TEXT,
  email_verified_at TIMESTAMPTZ,
  referrer_id UUID REFERENCES public.profiles(id),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Balance de puntos por usuario
CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  points BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Movimientos (depósito, retiro, faucet, apuesta, premio, comisión afiliado)
CREATE TYPE movement_type AS ENUM (
  'deposito_bolis', 'retiro_bolis', 'faucet', 'apuesta_hi_lo', 'premio_hi_lo',
  'comision_afiliado', 'recompensa', 'ajuste_admin'
);

CREATE TABLE IF NOT EXISTS public.movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type movement_type NOT NULL,
  points BIGINT NOT NULL,
  reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movements_user_id ON public.movements(user_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON public.movements(created_at DESC);

-- Afiliados: referidos y comisiones
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);

-- Recompensas (logros, misiones, etc.)
CREATE TABLE IF NOT EXISTS public.reward_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  points_reward BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_template_id UUID NOT NULL REFERENCES public.reward_templates(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, reward_template_id)
);

-- Control de sesiones / IP para límite de conexiones (anti-fraude)
CREATE TABLE IF NOT EXISTS public.session_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_session_ips_user ON public.session_ips(user_id);
CREATE INDEX IF NOT EXISTS idx_session_ips_ip ON public.session_ips(ip_hash);

-- Faucet: última reclamación por usuario
CREATE TABLE IF NOT EXISTS public.faucet_claims (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_claim_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Retiros pendientes / procesados (para admin)
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points BIGINT NOT NULL,
  wallet_destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON public.withdrawals(created_at DESC);

-- RLS (opcional: habilitar cuando uses Supabase Auth)
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- etc.
