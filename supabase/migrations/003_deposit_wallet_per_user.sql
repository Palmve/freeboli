-- Dirección de depósito exclusiva por usuario (ya no se usa memo)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deposit_address TEXT UNIQUE;

-- Clave privada cifrada por usuario (para poder hacer sweep al treasury)
CREATE TABLE IF NOT EXISTS public.deposit_wallets (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL UNIQUE,
  encrypted_private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_deposit_address ON public.profiles(deposit_address) WHERE deposit_address IS NOT NULL;
