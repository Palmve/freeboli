-- 028_withdrawal_safety_rpc.sql
-- Implementación atómica de la creación de solicitudes de retiro.
-- Asegura que un usuario no pueda retirar más de lo que tiene mediante clics concurrentes.

CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
    target_user_id UUID,
    amount_points BIGINT,
    dest_wallet TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    withdrawal_id UUID,
    result_balance BIGINT,
    error_message TEXT
) AS $$
DECLARE
    current_bal BIGINT;
    new_withdrawal_id UUID;
    v_status TEXT := 'pending';
    v_is_influencer BOOLEAN := FALSE;
    v_max_amount BIGINT := 999999999; -- Infinito por defecto para normales
    v_max_daily INTEGER := 99;
    v_daily_count INTEGER;
    v_auto_approve BOOLEAN := FALSE;
BEGIN
    -- 0. Verificar si es Influencer y obtener sus límites
    SELECT TRUE, max_withdrawal_amount, max_daily_withdrawals, auto_approve_withdrawals
    INTO v_is_influencer, v_max_amount, v_max_daily, v_auto_approve
    FROM influencer_configs
    WHERE user_id = target_user_id AND is_active = TRUE;

    v_is_influencer := COALESCE(v_is_influencer, FALSE);

    -- 1. Validar límite de monto (solo si es influencer o si hay un límite global)
    IF amount_points > v_max_amount THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0::BIGINT, 'Monto excede el límite permitido para influencers (' || (v_max_amount/1000) || ' Bolis)';
        RETURN;
    END IF;

    -- 2. Validar límite diario (solo para influencers)
    IF v_is_influencer THEN
        SELECT COUNT(*)::INTEGER INTO v_daily_count
        FROM withdrawals
        WHERE user_id = target_user_id 
          AND created_at > NOW() - INTERVAL '24 hours';
        
        IF v_daily_count >= v_max_daily THEN
            RETURN QUERY SELECT FALSE, NULL::UUID, 0::BIGINT, 'Límite de retiros diarios alcanzado (' || v_max_daily || ')';
            RETURN;
        END IF;

        IF v_auto_approve THEN
            v_status := 'processing'; -- Pasa directo a procesamiento (auto-aprobado)
        END IF;
    END IF;

    -- 3. Bloqueo de fila del balance
    SELECT points INTO current_bal 
    FROM public.balances 
    WHERE user_id = target_user_id 
    FOR UPDATE;

    -- 4. Verificación de saldo
    IF current_bal IS NULL OR current_bal < amount_points THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, COALESCE(current_bal, 0), 'Saldo insuficiente';
        RETURN;
    END IF;

    -- 5. Crear el registro de retiro
    INSERT INTO public.withdrawals (user_id, points, wallet_destination, status)
    VALUES (target_user_id, amount_points, dest_wallet, v_status)
    RETURNING id INTO new_withdrawal_id;

    -- 6. Restar puntos del balance
    UPDATE public.balances 
    SET points = points - amount_points,
        updated_at = now()
    WHERE user_id = target_user_id
    RETURNING points INTO current_bal;

    RETURN QUERY SELECT TRUE, new_withdrawal_id, current_bal, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

comment on function public.create_withdrawal_request is 'Crea una solicitud de retiro restando el balance de forma atómica con bloqueo de fila.';
