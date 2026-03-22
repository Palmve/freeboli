-- Add last_ip column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_ip text;
