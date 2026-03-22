-- 017_user_levels_v2.sql
-- Actualización del esquema para el sistema de niveles avanzado y seguridad.

-- 1. Añadir columnas a profiles para métricas de nivel y seguridad
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS prediction_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hilo_bet_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS faucet_claim_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_daily_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_notified_level INTEGER DEFAULT 1;

-- 2. Inicializar métricas desde el historial
UPDATE public.profiles p
SET 
  prediction_count = (SELECT count(*) FROM public.prediction_bets pb WHERE pb.user_id = p.id),
  hilo_bet_count = (SELECT count(*) FROM public.movements m WHERE m.user_id = p.id AND m.type = 'apuesta_hi_lo'),
  faucet_claim_count = (SELECT count(*) FROM public.movements m WHERE m.user_id = p.id AND m.type = 'faucet'),
  max_daily_streak = COALESCE((SELECT daily_streak FROM public.faucet_claims fc WHERE fc.user_id = p.id), 0);

-- 3. Función: place_prediction_bet (v2)
CREATE OR REPLACE FUNCTION public.place_prediction_bet(
    p_user_id UUID,
    p_round_id UUID,
    p_amount BIGINT,
    p_prediction TEXT,
    p_type TEXT,
    p_odds NUMERIC,
    p_payout BIGINT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    result_balance BIGINT
) AS $$
DECLARE
    current_bal BIGINT;
    bet_count INTEGER;
BEGIN
    SELECT points INTO current_bal FROM public.Balances WHERE user_id = p_user_id FOR UPDATE; -- Tabla Balances (estilo Case Sensitive anterior)
    IF current_bal IS NULL OR current_bal < p_amount THEN
        RETURN QUERY SELECT FALSE, 'Saldo insuficiente', COALESCE(current_bal, 0);
        RETURN;
    END IF;

    SELECT count(*) INTO bet_count FROM public.prediction_bets WHERE round_id = p_round_id AND user_id = p_user_id;
    IF bet_count >= 5 THEN
        RETURN QUERY SELECT FALSE, 'Límite de 5 apuestas por ronda alcanzado', current_bal;
        RETURN;
    END IF;

    UPDATE public.Balances SET points = points - p_amount, updated_at = now() WHERE user_id = p_user_id RETURNING points INTO current_bal;
    INSERT INTO public.prediction_bets (round_id, user_id, type, amount, prediction, odds_at_bet, potential_payout)
    VALUES (p_round_id, p_user_id, p_type, p_amount, p_prediction, p_odds, p_payout);

    -- INCREMENTO SEGURO DEL CONTADOR
    UPDATE public.profiles SET prediction_count = prediction_count + 1 WHERE id = p_user_id;

    INSERT INTO public.movements (user_id, type, points, metadata)
    VALUES (p_user_id, 'apuesta_prediccion', -p_amount, jsonb_build_object('round_id', p_round_id, 'odds', p_odds, 'prediction', p_prediction));

    RETURN QUERY SELECT TRUE, 'Apuesta realizada con éxito', current_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función: place_hilo_bet
CREATE OR REPLACE FUNCTION public.place_hilo_bet(
    p_user_id UUID,
    p_amount BIGINT
)
RETURNS TABLE (
    success BOOLEAN,
    result_balance BIGINT
) AS $$
DECLARE
    new_bal BIGINT;
BEGIN
    UPDATE public.Balances SET
        points = points - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id AND points >= p_amount
    RETURNING points INTO new_bal;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::BIGINT;
    ELSE
        -- INCREMENTO SEGURO DEL CONTADOR
        UPDATE public.profiles SET hilo_bet_count = hilo_bet_count + 1 WHERE id = p_user_id;
        RETURN QUERY SELECT TRUE, new_bal;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Función: update_faucet_stats
CREATE OR REPLACE FUNCTION public.update_faucet_stats(
    p_user_id UUID,
    p_current_streak INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles SET
        faucet_claim_count = faucet_claim_count + 1,
        max_daily_streak = GREATEST(max_daily_streak, p_current_streak)
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota de Seguridad: Evitar que el usuario manipule last_notified_level.
-- Se recomienda aplicar RLS en la tabla profiles:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can only update their own display name" ON profiles
-- FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND (prediction_count IS NOT DISTINCT FROM prediction_count) AND (last_notified_level IS NOT DISTINCT FROM last_notified_level));
