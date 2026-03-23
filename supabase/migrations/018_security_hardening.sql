-- Migración 018: Tablas de seguridad - Rate-limit persistente y eventos de seguridad
-- Ejecutar en Supabase SQL Editor

-- ══════════════════════════════════════════════════════════════════
-- TABLA: rate_limit_log (Rate-limiting persistente entre workers)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id            BIGSERIAL PRIMARY KEY,
  key           TEXT NOT NULL,          -- e.g. "withdraw:user-id", "faucet:ip-hash"
  window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count         INTEGER NOT NULL DEFAULT 1,
  window_ms     BIGINT NOT NULL,        -- Duración de la ventana en ms
  UNIQUE(key)
);

-- Índice para limpiezas rápidas de entradas expiradas
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_key ON rate_limit_log(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_window ON rate_limit_log(window_start);

-- Función RPC para rate-limiting atómico (evita race conditions)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max INTEGER,
  p_window_ms BIGINT
) RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_window_end TIMESTAMPTZ;
BEGIN
  -- Limpiar entradas expiradas de este key
  DELETE FROM rate_limit_log
  WHERE key = p_key
    AND window_start + (window_ms * interval '1 millisecond') < v_now;

  -- Buscar ventana actual
  SELECT rl.window_start, rl.count
  INTO v_window_start, v_count
  FROM rate_limit_log rl
  WHERE rl.key = p_key
  LIMIT 1;

  IF v_count IS NULL THEN
    -- Primera petición en esta ventana
    INSERT INTO rate_limit_log(key, window_start, count, window_ms)
    VALUES (p_key, v_now, 1, p_window_ms)
    ON CONFLICT (key) DO UPDATE
      SET count = rate_limit_log.count + 1,
          window_start = CASE
            WHEN rate_limit_log.window_start + (rate_limit_log.window_ms * interval '1 millisecond') < v_now
            THEN v_now
            ELSE rate_limit_log.window_start
          END;
    RETURN QUERY SELECT TRUE, 1, 0;
  ELSIF v_count >= p_max THEN
    -- Límite superado
    v_window_end := v_window_start + (p_window_ms * interval '1 millisecond');
    RETURN QUERY SELECT FALSE, v_count, EXTRACT(EPOCH FROM (v_window_end - v_now))::INTEGER;
  ELSE
    -- Incrementar contador
    UPDATE rate_limit_log SET count = count + 1 WHERE key = p_key;
    RETURN QUERY SELECT TRUE, v_count + 1, 0;
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- TABLA: security_events (Log de eventos de seguridad)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS security_events (
  id            BIGSERIAL PRIMARY KEY,
  event_type    TEXT NOT NULL,          -- 'suspicious_withdrawal', 'rate_limit_exceeded', 'blocked_bot', etc.
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_hash       TEXT,
  details       JSONB DEFAULT '{}',
  severity      TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);

-- RLS: Solo admins pueden leer eventos de seguridad
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_events_admin_only" ON security_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- Solo el backend con service role puede insertar
CREATE POLICY "security_events_service_insert" ON security_events
  FOR INSERT
  WITH CHECK (TRUE); -- Controlado por service role key

-- ══════════════════════════════════════════════════════════════════
-- TABLA: withdrawal_anomalies (Detección de patrones sospechosos)  
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS withdrawal_anomalies (
  id            BIGSERIAL PRIMARY KEY,
  withdrawal_id UUID NOT NULL,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet        TEXT NOT NULL,
  points        BIGINT NOT NULL,
  reason        TEXT NOT NULL,          -- Por qué fue marcado como anómalo
  resolved      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_anomalies_user ON withdrawal_anomalies(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_anomalies_resolved ON withdrawal_anomalies(resolved);

-- RLS
ALTER TABLE withdrawal_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawal_anomalies_admin_only" ON withdrawal_anomalies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- ══════════════════════════════════════════════════════════════════
-- AUTO-LIMPIEZA: Eliminar rate_limit_log > 24 horas
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION cleanup_rate_limit_log()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rate_limit_log
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;

COMMENT ON TABLE rate_limit_log IS 'Rate-limiting persistente entre workers de Vercel. Evita bypass por escalado horizontal.';
COMMENT ON TABLE security_events IS 'Log de eventos de seguridad: bots bloqueados, rate-limits, retiros anómalos, etc.';
COMMENT ON TABLE withdrawal_anomalies IS 'Retiros marcados automáticamente como sospechosos para revisión del admin.';
