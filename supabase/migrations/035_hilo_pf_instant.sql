-- 035_hilo_pf_instant.sql
-- Provably-fair con VERIFICACIÓN INSTANTÁNEA para HI-LO.
-- Cada tirada usa la semilla activa (ya comprometida por su hash) y, en la MISMA
-- operación, rota a una nueva semilla comprometida. La semilla usada se revela en la
-- respuesta (y se guarda en el movimiento), así cada jugada es verificable al momento.
-- La siguiente jugada usa otra semilla, por lo que revelar la usada no compromete nada.
-- Se actualiza la fila en sitio (no crece la tabla).

-- ============================================================================
-- consume_hilo_seed: devuelve la semilla activa (a usar en esta tirada) y la rota
-- a una nueva semilla comprometida. El client_seed persiste; el nonce incrementa.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consume_hilo_seed(
    p_user_id UUID,
    p_next_server_seed TEXT,
    p_next_server_seed_hash TEXT,
    p_fallback_server_seed TEXT,
    p_fallback_server_seed_hash TEXT,
    p_fallback_client_seed TEXT
)
RETURNS TABLE (
    used_server_seed TEXT,
    used_server_seed_hash TEXT,
    client_seed TEXT,
    nonce INTEGER,
    next_server_seed_hash TEXT
) AS $$
DECLARE
    v_id UUID; v_sseed TEXT; v_hash TEXT; v_cseed TEXT; v_nonce INTEGER;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('hilo_seed:' || p_user_id::text));

    SELECT s.id, s.server_seed, s.server_seed_hash, s.client_seed, s.nonce
      INTO v_id, v_sseed, v_hash, v_cseed, v_nonce
    FROM public.hilo_seeds s WHERE s.user_id = p_user_id AND s.active FOR UPDATE;

    IF v_id IS NULL THEN
        -- Sin semilla activa (no se cargó el panel): usar la fallback para esta tirada
        -- y dejar la "next" comprometida como activa.
        v_sseed := p_fallback_server_seed;
        v_hash := p_fallback_server_seed_hash;
        v_cseed := left(p_fallback_client_seed, 64);
        v_nonce := 0;
        INSERT INTO public.hilo_seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, active)
        VALUES (p_user_id, p_next_server_seed, p_next_server_seed_hash, v_cseed, 1, TRUE);
    ELSE
        -- Rotar la activa a la nueva semilla comprometida (client_seed persiste, nonce++).
        UPDATE public.hilo_seeds
           SET server_seed = p_next_server_seed,
               server_seed_hash = p_next_server_seed_hash,
               nonce = v_nonce + 1
         WHERE id = v_id;
    END IF;

    RETURN QUERY SELECT v_sseed, v_hash, v_cseed, v_nonce, p_next_server_seed_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- set_hilo_client_seed (v2): ahora editable EN CUALQUIER MOMENTO (cada tirada
-- registra su propio client_seed, así que cambiarlo solo afecta a las siguientes).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_hilo_client_seed(
    p_user_id UUID,
    p_client_seed TEXT
)
RETURNS TABLE (ok BOOLEAN, message TEXT) AS $$
DECLARE
    v_id UUID; v_clean TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('hilo_seed:' || p_user_id::text));

    v_clean := left(coalesce(p_client_seed, ''), 64);
    IF length(v_clean) = 0 THEN
        RETURN QUERY SELECT FALSE, 'Client seed inválido'; RETURN;
    END IF;

    SELECT s.id INTO v_id
    FROM public.hilo_seeds s WHERE s.user_id = p_user_id AND s.active FOR UPDATE;

    IF v_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'No hay semilla activa'; RETURN;
    END IF;

    UPDATE public.hilo_seeds SET client_seed = v_clean WHERE id = v_id;
    RETURN QUERY SELECT TRUE, 'Client seed actualizado';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Permisos: solo service role.
REVOKE EXECUTE ON FUNCTION public.consume_hilo_seed(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_hilo_seed(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
