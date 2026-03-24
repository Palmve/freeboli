-- v1.114: Add missing movement types to enum
-- This ensures that 'promo_claim' and 'deposito_promo' can be stored in the movements table.

DO $$
BEGIN
    -- Agregar 'promocion' si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'movement_type' AND e.enumlabel = 'promocion') THEN
        ALTER TYPE movement_type ADD VALUE 'promocion';
    END IF;

    -- Agregar 'promo_claim' si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'movement_type' AND e.enumlabel = 'promo_claim') THEN
        ALTER TYPE movement_type ADD VALUE 'promo_claim';
    END IF;

    -- Agregar 'deposito_promo' si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'movement_type' AND e.enumlabel = 'deposito_promo') THEN
        ALTER TYPE movement_type ADD VALUE 'deposito_promo';
    END IF;
END $$;
