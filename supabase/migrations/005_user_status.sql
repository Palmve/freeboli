-- 005: Add status column to profiles for admin abuse control
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'normal';
