-- ============================================================================
-- PROD_039_aplicar_y_verificar.sql
-- Copia y pega TODO este archivo en: Supabase -> SQL Editor -> New query -> Run
--
-- PARTE A = la migración 039 (DDL, idempotente: se puede correr varias veces).
-- PARTE B = smoke test de verificación (va en BEGIN ... ROLLBACK: NO deja datos).
--
-- Puedes correr todo de una vez. La PARTE A se aplica (commit implícito) y la
-- PARTE B se revierte sola con el ROLLBACK final, así que no ensucia la BD.
-- ============================================================================


-- ============================================================================
-- PARTE A — MIGRACIÓN 039 (wagering M1 + settings M2)
-- ============================================================================

-- 1. Columnas nuevas (grandfather con default 0)
ALTER TABLE public.balances
  ADD COLUMN IF NOT EXISTS locked_points BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wagering_remaining BIGINT NOT NULL DEFAULT 0;

-- 1b. DROP de las funciones a redefinir. Necesario porque la versión en producción
--     puede tener un return type distinto y CREATE OR REPLACE no puede cambiarlo
--     ("cannot change return type of existing function"). IF EXISTS = seguro/idempotente.
DROP FUNCTION IF EXISTS public.credit_bonus_points(uuid, bigint, integer);
DROP FUNCTION IF EXISTS public.place_hilo_bet(uuid, bigint);
DROP FUNCTION IF EXISTS public.place_prediction_bet(uuid, uuid, bigint, text, text, numeric, bigint);
DROP FUNCTION IF EXISTS public.create_withdrawal_request(uuid, bigint, text);

-- 2. credit_bonus_points: acredita bono bloqueando principal + sumando wagering
CREATE OR REPLACE FUNCTION public.credit_bonus_points(
    p_user_id UUID,
    p_amount BIGINT,
    p_wager_mult INTEGER
)
RETURNS TABLE (
    success BOOLEAN,
    result_balance BIGINT
) AS $$
DECLARE
    new_bal BIGINT;
BEGIN
    INSERT INTO public.balances (user_id, points, locked_points, wagering_remaining, updated_at)
    VALUES (p_user_id, p_amount, p_amount, p_amount * p_wager_mult, now())
    ON CONFLICT (user_id) DO UPDATE SET
        points = public.balances.points + EXCLUDED.points,
        locked_points = public.balances.locked_points + EXCLUDED.locked_points,
        wagering_remaining = public.balances.wagering_remaining + EXCLUDED.wagering_remaining,
        updated_at = now()
    RETURNING points INTO new_bal;

    RETURN QUERY SELECT TRUE, new_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.credit_bonus_points IS 'Acredita un bono: points += amount, locked_points += amount, wagering_remaining += amount*mult.';

-- 3. place_hilo_bet: redefinida con decremento de wagering + limpieza de lock
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
    -- Todas las expresiones SET usan los valores PREVIOS de la fila.
    UPDATE public.balances SET
        points = points - p_amount,
        wagering_remaining = GREATEST(0, wagering_remaining - p_amount),
        locked_points = CASE WHEN (wagering_remaining - p_amount) <= 0 THEN 0 ELSE locked_points END,
        updated_at = now()
    WHERE user_id = p_user_id AND points >= p_amount
    RETURNING points INTO new_bal;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::BIGINT;
    ELSE
        UPDATE public.profiles SET hilo_bet_count = hilo_bet_count + 1 WHERE id = p_user_id;
        RETURN QUERY SELECT TRUE, new_bal;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. place_prediction_bet: redefinida (cuerpo de 016 + decremento de wagering)
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
    SELECT points INTO current_bal FROM public.balances WHERE user_id = p_user_id FOR UPDATE;

    IF current_bal IS NULL OR current_bal < p_amount THEN
        RETURN QUERY SELECT FALSE, 'Saldo insuficiente', COALESCE(current_bal, 0);
        RETURN;
    END IF;

    SELECT count(*) INTO bet_count FROM public.prediction_bets WHERE round_id = p_round_id AND user_id = p_user_id;

    IF bet_count >= 5 THEN
        RETURN QUERY SELECT FALSE, 'Límite de 5 apuestas por ronda alcanzado', current_bal;
        RETURN;
    END IF;

    -- Descuento + decremento de wagering + limpieza de lock (valores PREVIOS en SET).
    UPDATE public.balances SET
        points = points - p_amount,
        wagering_remaining = GREATEST(0, wagering_remaining - p_amount),
        locked_points = CASE WHEN (wagering_remaining - p_amount) <= 0 THEN 0 ELSE locked_points END,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING points INTO current_bal;

    INSERT INTO public.prediction_bets (round_id, user_id, type, amount, prediction, odds_at_bet, potential_payout)
    VALUES (p_round_id, p_user_id, p_type, p_amount, p_prediction, p_odds, p_payout);

    INSERT INTO public.movements (user_id, type, points, metadata)
    VALUES (p_user_id, 'apuesta_prediccion', -p_amount, jsonb_build_object('round_id', p_round_id, 'odds', p_odds, 'prediction', p_prediction));

    RETURN QUERY SELECT TRUE, 'Apuesta realizada con éxito', current_bal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. create_withdrawal_request: redefinida (cuerpo de 028 + gate de retirable)
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
    v_locked BIGINT;
    new_withdrawal_id UUID;
    v_status TEXT := 'pending';
    v_is_influencer BOOLEAN := FALSE;
    v_max_amount BIGINT := 999999999;
    v_max_daily INTEGER := 99;
    v_daily_count INTEGER;
    v_auto_approve BOOLEAN := FALSE;
BEGIN
    SELECT TRUE, max_withdrawal_amount, max_daily_withdrawals, auto_approve_withdrawals
    INTO v_is_influencer, v_max_amount, v_max_daily, v_auto_approve
    FROM influencer_configs
    WHERE user_id = target_user_id AND is_active = TRUE;

    v_is_influencer := COALESCE(v_is_influencer, FALSE);

    IF amount_points > v_max_amount THEN
        -- error_message = CÓDIGO estable (el frontend lo traduce a es/en).
        RETURN QUERY SELECT FALSE, NULL::UUID, 0::BIGINT, 'influencer_amount_exceeded';
        RETURN;
    END IF;

    IF v_is_influencer THEN
        SELECT COUNT(*)::INTEGER INTO v_daily_count
        FROM withdrawals
        WHERE user_id = target_user_id
          AND created_at > NOW() - INTERVAL '24 hours';

        IF v_daily_count >= v_max_daily THEN
            RETURN QUERY SELECT FALSE, NULL::UUID, 0::BIGINT, 'influencer_daily_limit';
            RETURN;
        END IF;

        IF v_auto_approve THEN
            v_status := 'processing';
        END IF;
    END IF;

    -- Bloqueo de fila + lectura de locked_points
    SELECT points, locked_points INTO current_bal, v_locked
    FROM public.balances
    WHERE user_id = target_user_id
    FOR UPDATE;

    -- Gate M1: solo es retirable lo que supera el bono bloqueado.
    -- error_message = CÓDIGO 'wagering_locked' si el bloqueo es por bono; 'insufficient_balance' si simplemente no hay saldo.
    IF current_bal IS NULL OR (current_bal - COALESCE(v_locked, 0)) < amount_points THEN
        IF COALESCE(v_locked, 0) > 0 THEN
            RETURN QUERY SELECT FALSE, NULL::UUID, COALESCE(current_bal, 0), 'wagering_locked';
        ELSE
            RETURN QUERY SELECT FALSE, NULL::UUID, COALESCE(current_bal, 0), 'insufficient_balance';
        END IF;
        RETURN;
    END IF;

    INSERT INTO public.withdrawals (user_id, points, wallet_destination, status)
    VALUES (target_user_id, amount_points, dest_wallet, v_status)
    RETURNING id INTO new_withdrawal_id;

    -- Restar de points (locked_points no cambia: el retiro consume saldo retirable).
    UPDATE public.balances
    SET points = points - amount_points,
        updated_at = now()
    WHERE user_id = target_user_id
    RETURNING points INTO current_bal;

    RETURN QUERY SELECT TRUE, new_withdrawal_id, current_bal, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Settings por defecto (no pisar si ya existen)
INSERT INTO public.site_settings (key, value, updated_at)
VALUES
  ('WAGERING_MULTIPLIER', to_jsonb(20), now()),
  ('WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS', to_jsonb(500), now())
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- PARTE B — VERIFICACIÓN ESTRUCTURAL (read-only, no inserta nada, sin FK).
-- Confirma que la migración quedó aplicada. Resultado esperado (3 filas):
--   columnas  -> locked_points, wagering_remaining
--   funciones -> create_withdrawal_request, credit_bonus_points, place_hilo_bet, place_prediction_bet
--   settings  -> WAGERING_MULTIPLIER=20, WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS=500
-- ============================================================================

SELECT 'columnas' AS check, string_agg(column_name, ', ' ORDER BY column_name) AS detalle
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'balances'
  AND column_name IN ('locked_points', 'wagering_remaining')
UNION ALL
SELECT 'funciones', string_agg(DISTINCT proname, ', ' ORDER BY proname)
FROM pg_proc
WHERE proname IN ('credit_bonus_points', 'place_hilo_bet', 'place_prediction_bet', 'create_withdrawal_request')
UNION ALL
SELECT 'settings', string_agg(key || '=' || value::text, ', ' ORDER BY key)
FROM public.site_settings
WHERE key IN ('WAGERING_MULTIPLIER', 'WITHDRAWAL_DAILY_GLOBAL_CAP_BOLIS');


-- ============================================================================
-- PARTE C (OPCIONAL) — TEST FUNCIONAL con un usuario REAL, dentro de
-- BEGIN ... ROLLBACK: NO deja datos. Usa el primer usuario de profiles.
-- Para ejecutarlo: descomenta el bloque (quita el /* y el */) y córrelo solo.
-- Mira los mensajes "NOTICE" en la pestaña de resultados. Esperado:
--   1) tras bono   -> points=100 locked=100 wagering=2000
--   2) retiro 50   -> success=false error=wagering_locked
--   3) tras apostar-> locked=0 wagering=0
--   4) retiro 50   -> success=true
-- ============================================================================
/*
BEGIN;
DO $$
DECLARE
  u UUID;
  bal RECORD;
  w RECORD;
BEGIN
  SELECT id INTO u FROM public.profiles LIMIT 1;
  IF u IS NULL THEN RAISE NOTICE 'No hay usuarios en profiles; test omitido.'; RETURN; END IF;

  INSERT INTO public.balances (user_id, points, locked_points, wagering_remaining)
  VALUES (u, 0, 0, 0)
  ON CONFLICT (user_id) DO UPDATE SET points = 0, locked_points = 0, wagering_remaining = 0;

  PERFORM public.credit_bonus_points(u, 100, 20);
  SELECT points, locked_points, wagering_remaining INTO bal FROM public.balances WHERE user_id = u;
  RAISE NOTICE '1) tras bono -> points=% locked=% wagering=% (esperado 100/100/2000)', bal.points, bal.locked_points, bal.wagering_remaining;

  SELECT success, error_message INTO w FROM public.create_withdrawal_request(u, 50, 'TestWalletAddrxxxxxxxxxxxxxxxxxxxxx');
  RAISE NOTICE '2) retiro bloqueado -> success=% error=% (esperado false/wagering_locked)', w.success, w.error_message;

  UPDATE public.balances SET points = 5000 WHERE user_id = u;
  PERFORM public.place_hilo_bet(u, 2000);
  SELECT points, locked_points, wagering_remaining INTO bal FROM public.balances WHERE user_id = u;
  RAISE NOTICE '3) tras apostar -> locked=% wagering=% (esperado 0/0)', bal.locked_points, bal.wagering_remaining;

  SELECT success, error_message INTO w FROM public.create_withdrawal_request(u, 50, 'TestWalletAddrxxxxxxxxxxxxxxxxxxxxx');
  RAISE NOTICE '4) retiro permitido -> success=% error=% (esperado true)', w.success, w.error_message;
END $$;
ROLLBACK;
*/
