-- 012: Prediction Game (BTC/SOL/BOLIS Hourly)

-- Extender los tipos de movimiento
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type') THEN
        -- Si por alguna razón no existe, lo creamos (pero debería existir por 001_initial)
    ELSE
        BEGIN
            ALTER TYPE public.movement_type ADD VALUE 'apuesta_prediccion';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE public.movement_type ADD VALUE 'premio_prediccion';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- Tabla de rondas de predicción
CREATE TABLE IF NOT EXISTS public.prediction_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset TEXT NOT NULL, -- 'BTC', 'SOL', 'BOLIS'
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    opening_price NUMERIC,
    closing_price NUMERIC,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'resolved', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_rounds_asset_status ON public.prediction_rounds(asset, status);
CREATE INDEX IF NOT EXISTS idx_prediction_rounds_end_time ON public.prediction_rounds(end_time DESC);

-- Tabla de apuestas de predicción
CREATE TABLE IF NOT EXISTS public.prediction_bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES public.prediction_rounds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL CHECK (amount > 0),
    prediction TEXT NOT NULL, -- 'up', 'down'
    odds_at_bet NUMERIC NOT NULL DEFAULT 1.0, 
    potential_payout BIGINT NOT NULL, 
    claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_bets_user_round ON public.prediction_bets(user_id, round_id);
CREATE INDEX IF NOT EXISTS idx_prediction_bets_round ON public.prediction_bets(round_id);

-- Configuración inicial en site_settings (Actualizada según petición)
INSERT INTO public.site_settings (key, value) VALUES
  ('PREDICTION_HOUSE_EDGE', '0.05'),
  ('PREDICTION_MIN_BET', '10'),
  ('PREDICTION_MAX_BET', '10000'), -- Cambiado de 100k a 10k
  ('PREDICTION_CUTOFF_SECONDS', '600') -- Cambiado de 300 a 600 (10 minutos)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
