-- 036_predictions_daily_cap.sql
-- Límite diario de ganancias en Predicciones (#7), paridad con HI-LO.
-- resolve_prediction_bet ahora capa el premio al remanente diario (suma de
-- 'premio_prediccion' del día). Solo aplica a ganancias reales (status 'won');
-- las devoluciones por empate ('draw') se acreditan completas (es dinero del jugador).
--
-- El nuevo parámetro p_max_daily tiene DEFAULT 0 (= sin tope) para que una llamada
-- antigua de 4 args siga funcionando durante la ventana migración->deploy.

DROP FUNCTION IF EXISTS public.resolve_prediction_bet(UUID, UUID, TEXT, BIGINT);

CREATE OR REPLACE FUNCTION public.resolve_prediction_bet(
    p_bet_id UUID,
    p_round_id UUID,
    p_status TEXT,
    p_payout BIGINT,
    p_max_daily BIGINT DEFAULT 0
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
    today_start TIMESTAMPTZ;
    today_total BIGINT;
    allowed BIGINT;
    effective_payout BIGINT;
BEGIN
    -- 1. Bloqueo de fila para evitar procesamiento paralelo
    SELECT processed_at, user_id INTO is_processed, v_user_id
    FROM public.prediction_bets
    WHERE id = p_bet_id AND round_id = p_round_id
    FOR UPDATE;

    -- 2. Idempotencia: ya procesada
    IF is_processed IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, 'Apuesta ya procesada', 0::BIGINT;
        RETURN;
    END IF;

    effective_payout := p_payout;

    -- 3. Tope diario SOLO sobre ganancias reales (no devoluciones de empate).
    IF p_status = 'won' AND p_payout > 0 AND p_max_daily > 0 THEN
        today_start := date_trunc('day', now());
        SELECT COALESCE(sum(points), 0) INTO today_total
        FROM public.movements
        WHERE user_id = v_user_id
          AND type = 'premio_prediccion'
          AND created_at >= today_start;

        allowed := GREATEST(0, p_max_daily - today_total);
        IF p_payout > allowed THEN
            effective_payout := allowed; -- capar al remanente del día
        END IF;
    END IF;

    -- 4. Acreditar (si queda algo tras el tope)
    IF effective_payout > 0 THEN
        PERFORM public.atomic_add_points(v_user_id, effective_payout);
        SELECT points INTO current_bal FROM public.balances WHERE user_id = v_user_id;

        INSERT INTO public.movements (user_id, type, points, reference, metadata)
        VALUES (
            v_user_id,
            'premio_prediccion',
            effective_payout,
            'round:' || p_round_id || ':bet:' || p_bet_id,
            jsonb_build_object(
                'round_id', p_round_id,
                'bet_id', p_bet_id,
                'payout', effective_payout,
                'capped', (effective_payout < p_payout)
            )
        );
    ELSE
        SELECT points INTO current_bal FROM public.balances WHERE user_id = v_user_id;
    END IF;

    -- 5. Actualizar estado de la apuesta (payout = lo realmente acreditado)
    UPDATE public.prediction_bets SET
        status = p_status,
        payout = effective_payout,
        processed_at = now()
    WHERE id = p_bet_id;

    RETURN QUERY SELECT TRUE, 'Apuesta resuelta con éxito', COALESCE(current_bal, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
