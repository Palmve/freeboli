-- 011: Password reset tokens
-- Crea una tabla de tokens para permitir restablecer contraseña por email.

CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON public.password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON public.password_resets(expires_at);

