-- 016_financial_hardening.sql
-- Este archivo asegura que TODAS las operaciones de puntos sean atómicas y seguras contra condiciones de carrera.

-- 1. Función para Sumar Puntos Atómicamente
CREATE OR REPLACE FUNCTION public.atomic_add_points(
    target_user_id UUID,
    amount_to_add BIGINT
)
RETURNS TABLE (
    success BOOLEAN,
    result_balance BIGINT
) AS $$
DECLARE
    new_bal BIGINT;
BEGIN
    INSERT INTO public.balances (user_id, points, updated_at)
    VALUES (target_user_id, amount_to_add, now())
    ON CONFLICT (user_id) DO UPDATE SET
        points = public.balances.points + EXCLUDED.points,
        updated_at = now()
    RETURNING points INTO new_bal;

    RETURN QUERY SELECT TRUE, new_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para Restar Puntos Atómicamente (con verificación de saldo)
CREATE OR REPLACE FUNCTION public.atomic_subtract_points(
    target_user_id UUID,
    amount_to_subtract BIGINT
)
RETURNS TABLE (
    success BOOLEAN,
    result_balance BIGINT
) AS $$
DECLARE
    current_bal BIGINT;
BEGIN
    SELECT points INTO current_bal FROM public.balances WHERE user_id = target_user_id FOR UPDATE;
    
    IF current_bal IS NULL OR current_bal < amount_to_subtract THEN
        RETURN QUERY SELECT FALSE, COALESCE(current_bal, 0);
    ELSE
        UPDATE public.balances SET
            points = points - amount_to_subtract,
            updated_at = now()
        WHERE user_id = target_user_id
        RETURNING points INTO current_bal;
        
        RETURN QUERY SELECT TRUE, current_bal;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función para Realizar Apuesta de Predicción Atómicamente (con límite de 5)
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
    -- Bloqueo de fila para evitar carreras en el conteo de apuestas
    -- Usamos un lock consultivo o simplemente el lock de la ronda si fuera necesario, 
    -- pero aquí basta con contar en una transacción serializable o con bloqueo de fila de balance.
    
    -- Verificar saldo con bloqueo
    SELECT points INTO current_bal FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
    
    IF current_bal IS NULL OR current_bal < p_amount THEN
        RETURN QUERY SELECT FALSE, 'Saldo insuficiente', COALESCE(current_bal, 0);
        RETURN;
    END IF;

    -- Verificar límite de 5 apuestas por ronda
    SELECT count(*) INTO bet_count FROM public.prediction_bets WHERE round_id = p_round_id AND user_id = p_user_id;
    
    IF bet_count >= 5 THEN
        RETURN QUERY SELECT FALSE, 'Límite de 5 apuestas por ronda alcanzado', current_bal;
        RETURN;
    END IF;

    -- Ejecutar descuento
    UPDATE public.balances SET
        points = points - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING points INTO current_bal;

    -- Insertar Apuesta
    INSERT INTO public.prediction_bets (round_id, user_id, type, amount, prediction, odds_at_bet, potential_payout)
    VALUES (p_round_id, p_user_id, p_type, p_amount, p_prediction, p_odds, p_payout);

    -- Insertar Movimiento
    INSERT INTO public.movements (user_id, type, points, metadata)
    VALUES (p_user_id, 'apuesta_prediccion', -p_amount, jsonb_build_object('round_id', p_round_id, 'odds', p_odds, 'prediction', p_prediction));

    RETURN QUERY SELECT TRUE, 'Apuesta realizada con éxito', current_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función para Acreditar Premio Hi-Lo con Límite Diario (Anti-Race Condition)
CREATE OR REPLACE FUNCTION public.atomic_add_hilo_prize(
    p_user_id UUID,
    p_amount BIGINT,
    p_max_daily BIGINT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    result_balance BIGINT
) AS $$
DECLARE
    current_bal BIGINT;
    today_total BIGINT;
    today_start TIMESTAMPTZ;
BEGIN
    today_start := date_trunc('day', now());

    -- Bloquear balance para serializar
    SELECT points INTO current_bal FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
    
    -- Sumar hoy
    SELECT COALESCE(sum(points), 0) INTO today_total 
    FROM public.movements 
    WHERE user_id = p_user_id 
      AND type = 'premio_hi_lo' 
      AND created_at >= today_start;

    IF (today_total + p_amount) > p_max_daily THEN
        RETURN QUERY SELECT FALSE, 'Límite diario de ganancias alcanzado', COALESCE(current_bal, 0);
    ELSE
        UPDATE public.balances SET
            points = points + p_amount,
            updated_at = now()
        WHERE user_id = p_user_id
        RETURNING points INTO current_bal;
        
        RETURN QUERY SELECT TRUE, 'Premio acreditado', current_bal;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
