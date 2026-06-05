-- 034_hilo_provably_fair.sql
-- Provably-fair real para HI-LO: compromiso previo de server_seed (#2 auditoría juegos).
-- El server_seed se compromete (hash visible) ANTES de apostar y permanece secreto hasta
-- que el jugador rota la semilla. El nonce vive en BD (arregla #9: ya no se deriva del
-- conteo de movements). La aleatoriedad se genera en Node y se pasa por parámetro.

-- ============================================================================
-- Tabla de semillas
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hilo_seeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    server_seed TEXT NOT NULL,          -- secreto; se revela solo al rotar
    server_seed_hash TEXT NOT NULL,     -- público desde el inicio (compromiso)
    client_seed TEXT NOT NULL,          -- editable mientras nonce = 0
    nonce INTEGER NOT NULL DEFAULT 0,   -- incrementa por apuesta
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revealed_at TIMESTAMPTZ
);

-- Un único seed activo por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS hilo_seeds_one_active
    ON public.hilo_seeds (user_id) WHERE active;

-- Consulta de historial de semillas reveladas por usuario.
CREATE INDEX IF NOT EXISTS hilo_seeds_user_idx ON public.hilo_seeds (user_id, created_at DESC);

-- RLS: sin políticas -> ningún acceso directo de authenticated/anon vía PostgREST.
-- El acceso es solo vía RPCs SECURITY DEFINER llamados con service role.
ALTER TABLE public.hilo_seeds ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ensure_hilo_seed: devuelve el seed activo (creándolo si no existe), sin tocar nonce
-- ni revelar server_seed. Para mostrar el compromiso antes de apostar.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_hilo_seed(
    p_user_id UUID,
    p_new_server_seed TEXT,
    p_new_server_seed_hash TEXT,
    p_new_client_seed TEXT
)
RETURNS TABLE (id UUID, server_seed_hash TEXT, client_seed TEXT, nonce INTEGER) AS $$
DECLARE
    v_id UUID; v_hash TEXT; v_cseed TEXT; v_nonce INTEGER;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('hilo_seed:' || p_user_id::text));

    SELECT s.id, s.server_seed_hash, s.client_seed, s.nonce
      INTO v_id, v_hash, v_cseed, v_nonce
    FROM public.hilo_seeds s
    WHERE s.user_id = p_user_id AND s.active
    LIMIT 1;

    IF v_id IS NULL THEN
        INSERT INTO public.hilo_seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, active)
        VALUES (p_user_id, p_new_server_seed, p_new_server_seed_hash, left(p_new_client_seed, 64), 0, TRUE)
        RETURNING hilo_seeds.id, hilo_seeds.server_seed_hash, hilo_seeds.client_seed, hilo_seeds.nonce
        INTO v_id, v_hash, v_cseed, v_nonce;
    END IF;

    RETURN QUERY SELECT v_id, v_hash, v_cseed, v_nonce;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- set_hilo_client_seed: fija el client_seed del activo solo si nonce = 0.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_hilo_client_seed(
    p_user_id UUID,
    p_client_seed TEXT
)
RETURNS TABLE (ok BOOLEAN, message TEXT) AS $$
DECLARE
    v_id UUID; v_nonce INTEGER; v_clean TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('hilo_seed:' || p_user_id::text));

    SELECT s.id, s.nonce INTO v_id, v_nonce
    FROM public.hilo_seeds s WHERE s.user_id = p_user_id AND s.active FOR UPDATE;

    IF v_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'No hay semilla activa'; RETURN;
    END IF;
    IF v_nonce <> 0 THEN
        RETURN QUERY SELECT FALSE, 'Ya apostaste con esta semilla: rota para cambiar el client seed'; RETURN;
    END IF;

    v_clean := left(coalesce(p_client_seed, ''), 64);
    IF length(v_clean) = 0 THEN
        RETURN QUERY SELECT FALSE, 'Client seed inválido'; RETURN;
    END IF;

    UPDATE public.hilo_seeds SET client_seed = v_clean WHERE id = v_id;
    RETURN QUERY SELECT TRUE, 'Client seed actualizado';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- next_hilo_nonce: bloquea el seed activo, lo crea si no existe, incrementa nonce y
-- devuelve la semilla comprometida + nonce. Atómico -> nonces únicos en concurrencia.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.next_hilo_nonce(
    p_user_id UUID,
    p_new_server_seed TEXT,
    p_new_server_seed_hash TEXT,
    p_new_client_seed TEXT
)
RETURNS TABLE (seed_id UUID, server_seed TEXT, server_seed_hash TEXT, client_seed TEXT, nonce INTEGER) AS $$
DECLARE
    v_id UUID; v_sseed TEXT; v_hash TEXT; v_cseed TEXT; v_nonce INTEGER;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('hilo_seed:' || p_user_id::text));

    SELECT s.id, s.server_seed, s.server_seed_hash, s.client_seed, s.nonce
      INTO v_id, v_sseed, v_hash, v_cseed, v_nonce
    FROM public.hilo_seeds s WHERE s.user_id = p_user_id AND s.active FOR UPDATE;

    IF v_id IS NULL THEN
        v_sseed := p_new_server_seed;
        v_hash := p_new_server_seed_hash;
        v_cseed := left(p_new_client_seed, 64);
        INSERT INTO public.hilo_seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, active)
        VALUES (p_user_id, v_sseed, v_hash, v_cseed, 0, TRUE)
        RETURNING hilo_seeds.id INTO v_id;
        v_nonce := 0;
    END IF;

    v_nonce := v_nonce + 1;
    UPDATE public.hilo_seeds SET nonce = v_nonce WHERE id = v_id;

    RETURN QUERY SELECT v_id, v_sseed, v_hash, v_cseed, v_nonce;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- rotate_hilo_seed: revela el seed activo (lo desactiva) y crea uno nuevo activo.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rotate_hilo_seed(
    p_user_id UUID,
    p_new_server_seed TEXT,
    p_new_server_seed_hash TEXT,
    p_new_client_seed TEXT
)
RETURNS TABLE (
    revealed_server_seed TEXT,
    revealed_server_seed_hash TEXT,
    revealed_client_seed TEXT,
    revealed_nonce INTEGER,
    new_server_seed_hash TEXT,
    new_client_seed TEXT
) AS $$
DECLARE
    v_old_id UUID; v_old_sseed TEXT; v_old_hash TEXT; v_old_cseed TEXT; v_old_nonce INTEGER;
    v_new_cseed TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('hilo_seed:' || p_user_id::text));

    v_new_cseed := left(p_new_client_seed, 64);

    SELECT s.id, s.server_seed, s.server_seed_hash, s.client_seed, s.nonce
      INTO v_old_id, v_old_sseed, v_old_hash, v_old_cseed, v_old_nonce
    FROM public.hilo_seeds s WHERE s.user_id = p_user_id AND s.active FOR UPDATE;

    IF v_old_id IS NOT NULL THEN
        UPDATE public.hilo_seeds SET active = FALSE, revealed_at = now() WHERE id = v_old_id;
    END IF;

    INSERT INTO public.hilo_seeds (user_id, server_seed, server_seed_hash, client_seed, nonce, active)
    VALUES (p_user_id, p_new_server_seed, p_new_server_seed_hash, v_new_cseed, 0, TRUE);

    RETURN QUERY SELECT v_old_sseed, v_old_hash, v_old_cseed, v_old_nonce, p_new_server_seed_hash, v_new_cseed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- Permisos: solo service role puede ejecutar estos RPC (la API pasa currentUser.id).
-- Impide que un usuario invoque el RPC con el p_user_id de otro vía PostgREST.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.ensure_hilo_seed(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_hilo_client_seed(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_hilo_nonce(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rotate_hilo_seed(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_hilo_seed(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_hilo_client_seed(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_hilo_nonce(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rotate_hilo_seed(UUID, TEXT, TEXT, TEXT) TO service_role;
