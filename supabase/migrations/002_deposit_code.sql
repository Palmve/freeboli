-- Código único por usuario para acreditar depósitos por memo (sin pegar firma)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deposit_code TEXT UNIQUE;

-- Transacciones ya procesadas (evitar doble acreditación)
CREATE TABLE IF NOT EXISTS public.processed_deposits (
  tx_signature TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_bolis NUMERIC NOT NULL,
  points_added BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_deposits_user ON public.processed_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_deposit_code ON public.profiles(deposit_code) WHERE deposit_code IS NOT NULL;
