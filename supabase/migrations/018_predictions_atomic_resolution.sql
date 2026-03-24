-- 018_predictions_atomic_resolution.sql
-- Resolución atómica de apuestas de predicción para evitar doble pago y condiciones de carrera.

CREATE OR REPLACE FUNCTION public.resolve_prediction_bet(
    p_bet_id UUID,
    p_round_id UUID,
    p_status TEXT,
    p_payout BIGINT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    result_balance BIGINT
) AS $$
DECLARE
    current_bal BIGINT;
    is_processed TIMESTAMPTZ;
    v_user_id UUID;
BEGIN
    -- 1. Bloqueo de fila de la apuesta para evitar procesamiento paralelo
    SELECT processed_at, user_id INTO is_processed, v_user_id 
    FROM public.prediction_bets 
    WHERE id = p_bet_id AND round_id = p_round_id
    FOR UPDATE;

    -- 2. Verificar si ya fue procesada
    IF is_processed IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, 'Apuesta ya procesada', 0::BIGINT;
        RETURN;
    END IF;

    -- 3. Si hay premio/devolución, acreditar atómicamente
    IF p_payout > 0 THEN
        -- Usamos atomic_add_points definido en migración 016
        PERFORM public.atomic_add_points(v_user_id, p_payout);
        
        -- Obtener balance final para retornar
        SELECT points INTO current_bal FROM public.balances WHERE user_id = v_user_id;

        -- Insertar movimiento de premio
        INSERT INTO public.movements (user_id, type, points, reference, metadata)
        VALUES (
            v_user_id, 
            'premio_prediccion', 
            p_payout, 
            'round:' || p_round_id || ':bet:' || p_bet_id,
            jsonb_build_object('round_id', p_round_id, 'bet_id', p_bet_id, 'payout', p_payout)
        );
    ELSE
        SELECT points INTO current_bal FROM public.balances WHERE user_id = v_user_id;
    END IF;

    -- 4. Actualizar estado de la apuesta
    UPDATE public.prediction_bets SET
        status = p_status,
        payout = p_payout,
        processed_at = now()
    WHERE id = p_bet_id;

    RETURN QUERY SELECT TRUE, 'Apuesta resuelta con éxito', COALESCE(current_bal, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
