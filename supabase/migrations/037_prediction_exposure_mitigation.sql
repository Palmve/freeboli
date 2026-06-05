-- 037_prediction_exposure_mitigation.sql
-- Mitigación inmediata del hallazgo de auditoría en Predicciones (modelo de cuotas
-- explotable por estrategia "momentum": ver scripts/audit_predictions.mjs).
--
-- Mientras se despliega la corrección de fondo del modelo (probit calibrado), acotamos
-- el daño:
--   1) PREDICTION_MAX_ODDS  (cap de cuota): 30x -> 10x. Elimina las apuestas de cola
--      (lado improbable a 30x) donde el RTP del jugador llegaba a ~215% en alta volatilidad.
--   2) PREDICTION_MAX_ROUND_PAYOUT_PER_SIDE (tope de exposición por lado): 1.000.000 ->
--      400.000 fichas. Pérdida neta máx por ronda baja de ~967k (9,7% de la reserva de
--      10M) a ~360k (3,6%).
--
-- Ambos son settings leídos por getSetting con DEFAULT en código; sembrarlos aquí los
-- hace efectivos de inmediato y editables desde el panel de administración.

INSERT INTO public.site_settings (key, value) VALUES
  ('PREDICTION_MAX_ODDS', '10'),
  ('PREDICTION_MAX_ROUND_PAYOUT_PER_SIDE', '400000')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
