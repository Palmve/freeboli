-- Infraestructura segura para depósitos BOLIS → pozo de promoción
-- (pending_promo_deposits, RPC atómico, promo_id en processed_deposits)

-- 1) Intención: el próximo depósito del usuario va al pozo de una campaña
CREATE TABLE IF NOT EXISTS public.pending_promo_deposits (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  promo_id UUID NOT NULL REFERENCES public.promociones(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pending_promo_deposits_pkey PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_promo_deposits_promo ON public.pending_promo_deposits(promo_id);

COMMENT ON TABLE public.pending_promo_deposits IS 'Asocia el siguiente depósito BOLIS del usuario al pozo de la campaña indicada.';

-- 2) Opcional: trazabilidad en depósitos procesados (sin FK duro a promociones por si se borra la fila)
ALTER TABLE public.processed_deposits
  ADD COLUMN IF NOT EXISTS promo_id UUID;

CREATE INDEX IF NOT EXISTS idx_processed_deposits_promo ON public.processed_deposits(promo_id) WHERE promo_id IS NOT NULL;

-- 3) Incremento atómico del pozo (evita carreras y bypass de UI)
CREATE OR REPLACE FUNCTION public.atomic_add_promo_points(
  target_promo_id UUID,
  amount_to_add BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF amount_to_add IS NULL OR amount_to_add <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  UPDATE public.promociones
  SET
    puntos_totales = puntos_totales + amount_to_add,
    puntos_restantes = puntos_restantes + amount_to_add
  WHERE id = target_promo_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'promo_not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_add_promo_points(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_add_promo_points(UUID, BIGINT) TO service_role;
