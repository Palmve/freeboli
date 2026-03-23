-- Migration: Promotional Word System (v1.093)
-- Description: Adds tables and RPC for promotional code claims.

-- 1. Agregar tipo de movimiento 'promocion' al enum si no existe
-- Nota: En Postgres no se puede hacer ADD VALUE dentro de una transacción si ya se usó el tipo.
-- Intentamos agregarlo de forma segura.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'movement_type' AND e.enumlabel = 'promocion') THEN
        ALTER TYPE movement_type ADD VALUE 'promocion';
    END IF;
END $$;

-- 2. Tabla de promociones (Campañas)
CREATE TABLE IF NOT EXISTS public.promociones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  palabra TEXT NOT NULL,
  puntos_totales BIGINT NOT NULL,
  puntos_restantes BIGINT NOT NULL,
  puntos_por_usuario BIGINT NOT NULL,
  link_fuente TEXT DEFAULT 'https://x.com/BolivarCoin_XT',
  is_active BOOLEAN DEFAULT true,
  fecha_inicio TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de reclamos (Historial por usuario)
CREATE TABLE IF NOT EXISTS public.promociones_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id UUID NOT NULL REFERENCES public.promociones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points_awarded BIGINT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(promo_id, user_id)
);

-- 4. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_promociones_activa ON public.promociones(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promociones_palabra ON public.promociones(palabra);
CREATE INDEX IF NOT EXISTS idx_promo_claims_user ON public.promociones_claims(user_id);

-- 5. Función RPC para reclamar (Operación Atómica Protegida)
CREATE OR REPLACE FUNCTION public.fn_claim_promotion(
  p_user_id UUID,
  p_word TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promo RECORD;
  v_already_claimed BOOLEAN;
BEGIN
  -- 1. Buscar promo activa por palabra (insensible a mayúsculas) y Bloquear fila (FOR UPDATE)
  -- Esto evita race conditions (que dos personas reclamen el último cupo simultáneamente)
  SELECT * FROM public.promociones 
  WHERE LOWER(palabra) = LOWER(p_word) 
    AND is_active = true 
    AND puntos_restantes >= puntos_por_usuario
  LIMIT 1
  FOR UPDATE INTO v_promo;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código incorrecto, promoción inactiva o puntos agotados.');
  END IF;

  -- 2. Verificar si el usuario ya reclamó esta promoción
  SELECT EXISTS(
    SELECT 1 FROM public.promociones_claims 
    WHERE promo_id = v_promo.id AND user_id = p_user_id
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya has reclamado esta promoción anteriormente.');
  END IF;

  -- 3. Proceso de adjudicación (Atómico)
  
  -- A. Restar del pozo de la promoción
  UPDATE public.promociones 
  SET puntos_restantes = puntos_restantes - v_promo.puntos_por_usuario 
  WHERE id = v_promo.id;

  -- B. Sumar al balance del usuario
  UPDATE public.balances 
  SET points = points + v_promo.puntos_por_usuario, 
      updated_at = now() 
  WHERE user_id = p_user_id;

  -- C. Registrar movimiento en el historial financiero
  INSERT INTO public.movements (user_id, type, points, reference, metadata)
  VALUES (p_user_id, 'promocion', v_promo.puntos_por_usuario, v_promo.nombre, jsonb_build_object('promo_id', v_promo.id));

  -- D. Registrar el reclamo para evitar duplicados
  INSERT INTO public.promociones_claims (promo_id, user_id, points_awarded)
  VALUES (v_promo.id, p_user_id, v_promo.puntos_por_usuario);

  RETURN jsonb_build_object(
    'success', true, 
    'message', '¡Promoción canjeada con éxito!',
    'points', v_promo.puntos_por_usuario, 
    'promo_name', v_promo.nombre
  );

EXCEPTION WHEN OTHERS THEN
  -- En caso de error inesperado, Postgres hace rollback automático de la transacción
  RETURN jsonb_build_object('success', false, 'error', 'Error en la transacción: ' || SQLERRM);
END;
$$;
