-- Migración 029: Sistema de Influencers y Bonos por Conversión
-- Objetivo: Gestionar convenios con influencers, límites de retiro especiales y pagos por usuarios verificados.

-- 1. Extender los tipos de movimientos
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'influencer_bounty';

-- 2. Tabla de configuración de Influencers
CREATE TABLE IF NOT EXISTS influencer_configs (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    bounty_per_confirmed_user BIGINT NOT NULL DEFAULT 0, -- Puntos por cada correo confirmado
    max_withdrawal_amount BIGINT NOT NULL DEFAULT 500000, -- 500 Bolis
    max_daily_withdrawals INTEGER NOT NULL DEFAULT 3,
    auto_approve_withdrawals BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_influencer_configs_active ON influencer_configs(is_active) WHERE is_active = TRUE;

-- 4. Función de trigger para pagar el bono de influencer cuando un referido se verifica
-- Esta función se dispara cuando 'email_verified_at' en profiles pasa de NULL a un valor.
CREATE OR REPLACE FUNCTION handle_influencer_conversion()
RETURNS TRIGGER AS $$
DECLARE
    v_referrer_id UUID;
    v_bounty BIGINT;
BEGIN
    -- Solo actuar si el email_verified_at cambia a no nulo
    IF (OLD.email_verified_at IS NULL AND NEW.email_verified_at IS NOT NULL) THEN
        -- Obtener el referrer
        v_referrer_id := NEW.referrer_id;
        
        IF v_referrer_id IS NOT NULL THEN
            -- Verificar si el referrer es un influencer activo
            SELECT bounty_per_confirmed_user INTO v_bounty
            FROM influencer_configs
            WHERE user_id = v_referrer_id AND is_active = TRUE;
            
            -- Si es influencer y tiene un bono configurado > 0
            IF v_bounty > 0 THEN
                -- 1. Sumar puntos al balance del influencer
                UPDATE balances 
                SET points = points + v_bounty, 
                    updated_at = NOW()
                WHERE user_id = v_referrer_id;
                
                -- 2. Registrar el movimiento
                INSERT INTO movements (user_id, type, points, reference, metadata)
                VALUES (
                    v_referrer_id, 
                    'influencer_bounty', 
                    v_bounty, 
                    'conversion:' || NEW.id,
                    jsonb_build_object(
                        'referred_user_id', NEW.id,
                        'referred_email', NEW.email
                    )
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Vincular el trigger a la tabla profiles
DROP TRIGGER IF EXISTS trg_influencer_conversion ON profiles;
CREATE TRIGGER trg_influencer_conversion
    AFTER UPDATE OF email_verified_at ON profiles
    FOR EACH ROW
    WHEN (OLD.email_verified_at IS NULL AND NEW.email_verified_at IS NOT NULL)
    EXECUTE FUNCTION handle_influencer_conversion();

-- 6. Comentarios
COMMENT ON TABLE influencer_configs IS 'Configuración de límites y pagos especiales para usuarios marcados como influencers.';
COMMENT ON COLUMN influencer_configs.bounty_per_confirmed_user IS 'Monto en puntos pagado al influencer cuando un referido suyo verifica su correo.';
