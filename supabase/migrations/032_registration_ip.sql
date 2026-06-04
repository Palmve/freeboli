-- 032: registration_ip para detección Sybil (checkSameIPReferral leía una columna inexistente).
-- Antes solo existía last_ip (016), que se sobrescribe en cada reclamo de faucet.
-- registration_ip queda fija al momento del alta y sirve para correlacionar cuentas hermanas.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_ip TEXT;

-- Backfill best-effort: usar last_ip conocido cuando exista y no haya registration_ip.
UPDATE public.profiles
  SET registration_ip = last_ip
  WHERE registration_ip IS NULL AND last_ip IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_registration_ip
  ON public.profiles(registration_ip);
