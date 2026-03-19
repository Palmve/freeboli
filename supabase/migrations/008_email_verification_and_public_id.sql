-- 008: Email verification tokens + public 6-digit user id + referral code

-- 1) Add public_id (6 digits) and referral_code to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_id INT,
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Enforce basic range (6 digits). We keep it NOT VALID first to avoid issues on existing rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_public_id_6_digits'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_public_id_6_digits CHECK (public_id BETWEEN 100000 AND 999999) NOT VALID;
  END IF;
END $$;

-- Unique constraints/indexes (allow NULLs until backfilled)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_public_id_unique ON public.profiles(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique ON public.profiles(referral_code);

-- Helper function to generate unique 6-digit id
CREATE OR REPLACE FUNCTION public.generate_unique_public_id()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  candidate INT;
  tries INT := 0;
BEGIN
  LOOP
    tries := tries + 1;
    IF tries > 2000 THEN
      RAISE EXCEPTION 'Could not generate unique public_id';
    END IF;
    candidate := (floor(random() * 900000) + 100000)::INT;
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.public_id = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

-- Backfill existing users
UPDATE public.profiles
SET public_id = public.generate_unique_public_id()
WHERE public_id IS NULL;

UPDATE public.profiles
SET referral_code = public_id::TEXT
WHERE referral_code IS NULL AND public_id IS NOT NULL;

-- Validate constraint now that we backfilled
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_public_id_6_digits;

-- 2) Email verification tokens table
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON public.email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON public.email_verifications(expires_at);

