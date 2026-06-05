-- 038_prediction_live_volatility.sql
-- σ viva (EWMA) para el modelo de cuotas de Predicciones + colchón de edge.
-- Ver docs/superpowers/specs/2026-06-05-prediccion-sigma-viva-ewma-design.md
--
--  1) PREDICTION_HOUSE_EDGE 0.05 -> 0.07 (colchón ante error de estimación de σ).
--  2) Inicializa PREDICTION_SIGMA_LIVE_<asset> al baseline con at=0 (forzando el piso
--     baseline hasta que el primer tick del cron escriba la σ realizada). Objeto {sigma, at}.

INSERT INTO public.site_settings (key, value) VALUES
  ('PREDICTION_HOUSE_EDGE', '0.07'),
  ('PREDICTION_SIGMA_LIVE_BTC', '{"sigma":0.0065,"at":0}'),
  ('PREDICTION_SIGMA_LIVE_SOL', '{"sigma":0.012,"at":0}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
