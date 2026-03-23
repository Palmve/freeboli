-- v1.094: Seguridad y Cooldown Anti-Bot para Promociones
-- Este script requiere que 022_promotional_word_system.sql ya haya sido ejecutado.

-- 1. Crear tabla de cooldowns si no existe
CREATE TABLE IF NOT EXISTS public.promo_cooldowns (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attempts_count INT DEFAULT 1
);

comment on table public.promo_cooldowns is 'Rastrea intentos de canje para prevenir fuerza bruta.';

-- 2. Actualizar la función RPC para incluir lógica de cooldown y sanitización
CREATE OR REPLACE FUNCTION public.fn_claim_promotion(p_user_id UUID, p_word TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_promo_id UUID;
    v_puntos_por_usuario INT;
    v_puntos_restantes INT;
    v_cooldown_seconds INT := 5; -- 5 segundos de espera entre intentos
    v_last_attempt TIMESTAMP WITH TIME ZONE;
BEGIN
    -- A. Verificación de Cooldown (Anti-Bot)
    SELECT last_attempt_at INTO v_last_attempt 
    FROM public.promo_cooldowns 
    WHERE user_id = p_user_id;

    IF v_last_attempt IS NOT NULL AND (NOW() - v_last_attempt) < (v_cooldown_seconds * interval '1 second') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Por favor, espera unos segundos antes de intentar de nuevo (Anti-Spam).'
        );
    END IF;

    -- B. Actualizar/Insertar cooldown
    INSERT INTO public.promo_cooldowns (user_id, last_attempt_at)
    VALUES (p_user_id, NOW())
    ON CONFLICT (user_id) DO UPDATE 
    SET last_attempt_at = NOW(), attempts_count = promo_cooldowns.attempts_count + 1;

    -- C. Sanitización básica y búsqueda de promoción activa
    -- La palabra ya viene sanitizada desde la API, pero aquí comparamos de forma segura.
    SELECT id, puntos_por_usuario, puntos_restantes 
    INTO v_promo_id, v_puntos_por_usuario, v_puntos_restantes
    FROM public.promociones
    WHERE is_active = true 
      AND UPPER(palabra) = UPPER(TRIM(p_word))
      AND puntos_restantes >= puntos_por_usuario
    LIMIT 1
    FOR UPDATE; -- Bloqueo de fila para atomicidad

    -- D. Validaciones de negocio
    IF v_promo_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Palabra incorrecta o promoción agotada.');
    END IF;

    -- Verificar si ya reclamó
    IF EXISTS (SELECT 1 FROM public.promociones_claims WHERE promo_id = v_promo_id AND user_id = p_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ya has reclamado esta promoción.');
    END IF;

    -- E. Ejecución del reclamo (Transacción Atómica)
    -- 1. Restar puntos del pozo
    UPDATE public.promociones 
    SET puntos_restantes = puntos_restantes - v_puntos_por_usuario
    WHERE id = v_promo_id;

    -- 2. Sumar puntos al usuario
    UPDATE public.balances 
    SET points = points + v_puntos_por_usuario
    WHERE user_id = p_user_id;

    -- 3. Registrar el reclamo
    INSERT INTO public.promociones_claims (promo_id, user_id, points_awarded)
    VALUES (v_promo_id, p_user_id, v_puntos_por_usuario);

    -- 4. Registrar movimiento
    INSERT INTO public.movements (user_id, points, type, description)
    VALUES (p_user_id, v_puntos_por_usuario, 'promo_claim', 'Reclamo de palabra promocional: ' || p_word);

    RETURN jsonb_build_object(
        'success', true, 
        'message', '¡Felicidades! Has recibido ' || v_puntos_por_usuario || ' puntos.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Error interno del servidor: ' || SQLERRM);
END;
$$;
