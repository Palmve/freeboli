-- 014: Short IDs for Prediction Bets

-- Función para generar IDs alfanuméricos aleatorios de 8 caracteres
CREATE OR REPLACE FUNCTION generate_prediction_short_id() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excluye I, O, 0, 1 para evitar confusión
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Añadir columna short_id a prediction_bets
ALTER TABLE public.prediction_bets ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

-- Actualizar registros existentes (si los hay)
UPDATE public.prediction_bets SET short_id = generate_prediction_short_id() WHERE short_id IS NULL;

-- Trigger para generar el ID automáticamente al insertar
CREATE OR REPLACE FUNCTION trg_prediction_bets_gen_id() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.short_id IS NULL THEN
    NEW.short_id := generate_prediction_short_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gen_prediction_short_id ON public.prediction_bets;
CREATE TRIGGER trg_gen_prediction_short_id
BEFORE INSERT ON public.prediction_bets
FOR EACH ROW
EXECUTE FUNCTION trg_prediction_bets_gen_id();
