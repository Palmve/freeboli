-- 009: Add missing movement_type enum values (logro, premio_ranking, bonus_referido_verificado)
-- So that leaderboard and rewards/prizes can store these types.

ALTER TYPE public.movement_type ADD VALUE IF NOT EXISTS 'logro';
ALTER TYPE public.movement_type ADD VALUE IF NOT EXISTS 'premio_ranking';
ALTER TYPE public.movement_type ADD VALUE IF NOT EXISTS 'bonus_referido_verificado';
