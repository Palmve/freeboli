-- 033: email_canonical para anti-Sybil por alias de Gmail (+tag y puntos).
-- La unicidad real se valida en la app (canonicalizeEmail) en cada alta.
-- Aquí solo añadimos la columna + backfill best-effort + indice de búsqueda.
-- NO se añade UNIQUE: los datos existentes pueden tener colisiones de granjas
-- previas y romperian la migracion; la app bloquea las NUEVAS colisiones.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_canonical TEXT;

-- Backfill básico: minúsculas. (La normalización fina de Gmail se aplica a las
-- altas nuevas desde la app; aquí basta con poblar para búsquedas.)
UPDATE public.profiles
  SET email_canonical = lower(email)
  WHERE email_canonical IS NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email_canonical
  ON public.profiles(email_canonical);
