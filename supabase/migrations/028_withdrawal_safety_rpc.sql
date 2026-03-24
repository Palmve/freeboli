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
    result_balance BIGINT
) AS $$
DECLARE
    current_bal BIGINT;
    new_withdrawal_id UUID;
BEGIN
    -- 1. Bloqueo de fila del balance para evitar Race Conditions
    SELECT points INTO current_bal 
    FROM public.balances 
    WHERE user_id = target_user_id 
    FOR UPDATE;

    -- 2. Verificación de saldo
    IF current_bal IS NULL OR current_bal < amount_points THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, COALESCE(current_bal, 0);
        RETURN;
    END IF;

    -- 3. Crear el registro de retiro (Estado inicial: pending)
    INSERT INTO public.withdrawals (user_id, points, wallet_destination, status)
    VALUES (target_user_id, amount_points, dest_wallet, 'pending')
    RETURNING id INTO new_withdrawal_id;

    -- 4. Restar puntos del balance
    UPDATE public.balances 
    SET points = points - amount_points,
        updated_at = now()
    WHERE user_id = target_user_id
    RETURNING points INTO current_bal;

    -- Nota: El registro en 'movements' se hace en la capa de aplicación (API) 
    -- según la estructura actual de FreeBoli, pero aquí aseguramos la integridad del balance.

    RETURN QUERY SELECT TRUE, new_withdrawal_id, current_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

comment on function public.create_withdrawal_request is 'Crea una solicitud de retiro restando el balance de forma atómica con bloqueo de fila.';
