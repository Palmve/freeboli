-- v1.113: Fix for "column description does not exist" in movements table
-- Re-defining fn_claim_promotion with correct column names (reference/metadata)

CREATE OR REPLACE FUNCTION public.fn_claim_promotion(p_user_id UUID, p_word TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_promo_id UUID;
    v_puntos_por_usuario INT;
    v_puntos_restantes INT;
    v_cooldown_seconds INT := 5; 
    v_last_attempt TIMESTAMP WITH TIME ZONE;
BEGIN
    -- A. Verificación de Cooldown
    SELECT last_attempt_at INTO v_last_attempt 
    FROM public.promo_cooldowns 
    WHERE user_id = p_user_id;

    IF v_last_attempt IS NOT NULL AND (NOW() - v_last_attempt) < (v_cooldown_seconds * interval '1 second') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Por favor, espera unos segundos antes de intentar de nuevo (Anti-Spam).'
        );
    END IF;

    -- B. Actualizar cooldown
    INSERT INTO public.promo_cooldowns (user_id, last_attempt_at)
    VALUES (p_user_id, NOW())
    ON CONFLICT (user_id) DO UPDATE 
    SET last_attempt_at = NOW(), attempts_count = promo_cooldowns.attempts_count + 1;

    -- C. Búsqueda de promoción activa
    SELECT id, puntos_por_usuario, puntos_restantes 
    INTO v_promo_id, v_puntos_por_usuario, v_puntos_restantes
    FROM public.promociones
    WHERE is_active = true 
      AND UPPER(palabra) = UPPER(TRIM(p_word))
      AND puntos_restantes >= puntos_por_usuario
    LIMIT 1
    FOR UPDATE;

    IF v_promo_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Palabra incorrecta o promoción agotada.');
    END IF;

    -- Verificar si ya reclamó
    IF EXISTS (SELECT 1 FROM public.promociones_claims WHERE promo_id = v_promo_id AND user_id = p_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ya has reclamado esta promoción.');
    END IF;

    -- E. Ejecución del reclamo
    UPDATE public.promociones 
    SET puntos_restantes = puntos_restantes - v_puntos_por_usuario
    WHERE id = v_promo_id;

    UPDATE public.balances 
    SET points = points + v_puntos_por_usuario
    WHERE user_id = p_user_id;

    INSERT INTO public.promociones_claims (promo_id, user_id, points_awarded)
    VALUES (v_promo_id, p_user_id, v_puntos_por_usuario);

    -- FIX: Cambiado 'description' por 'reference' y 'metadata'
    INSERT INTO public.movements (user_id, points, type, reference, metadata)
    VALUES (
        p_user_id, 
        v_puntos_por_usuario, 
        'promo_claim', 
        'PROMO: ' || p_word, 
        jsonb_build_object('promo_id', v_promo_id, 'word', p_word)
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', '¡Felicidades! Has recibido ' || v_puntos_por_usuario || ' puntos.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Error interno: ' || SQLERRM);
END;
$$;
