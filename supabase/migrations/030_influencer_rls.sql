-- Migración 030: RLS para influencer_configs + guarda anti-doble-pago en trigger
-- Seguridad: La tabla influencer_configs solo debe ser accesible vía service_role (backend).

-- 1. Activar RLS en influencer_configs
ALTER TABLE influencer_configs ENABLE ROW LEVEL SECURITY;

-- Política restrictiva: bloquea todo acceso directo (anon, authenticated).
-- Solo service_role (que bypasea RLS) podrá leer/escribir.
CREATE POLICY "service_only_influencer_configs"
ON influencer_configs FOR ALL
USING (false)
WITH CHECK (false);

-- 2. Actualizar el trigger de conversión para prevenir doble-pago
-- y remover PII (email) del metadata.
CREATE OR REPLACE FUNCTION handle_influencer_conversion()
RETURNS TRIGGER AS $$
DECLARE
    v_referrer_id UUID;
    v_bounty BIGINT;
    v_already_paid BOOLEAN;
BEGIN
    -- Solo actuar si el email_verified_at cambia a no nulo
    IF (OLD.email_verified_at IS NULL AND NEW.email_verified_at IS NOT NULL) THEN
        v_referrer_id := NEW.referrer_id;
        
        IF v_referrer_id IS NOT NULL THEN
            -- Verificar si el referrer es un influencer activo
            SELECT bounty_per_confirmed_user INTO v_bounty
            FROM influencer_configs
            WHERE user_id = v_referrer_id AND is_active = TRUE;
            
            IF v_bounty > 0 THEN
                -- GUARDA ANTI-DOBLE-PAGO: verificar que no exista ya un pago por este referido
                SELECT EXISTS(
                    SELECT 1 FROM movements 
                    WHERE user_id = v_referrer_id 
                      AND type = 'influencer_bounty' 
                      AND reference = 'conversion:' || NEW.id
                ) INTO v_already_paid;

                IF NOT v_already_paid THEN
                    -- Sumar puntos al balance del influencer
                    UPDATE balances 
                    SET points = points + v_bounty, 
                        updated_at = NOW()
                    WHERE user_id = v_referrer_id;
                    
                    -- Registrar el movimiento (sin PII, solo user_id)
                    INSERT INTO movements (user_id, type, points, reference, metadata)
                    VALUES (
                        v_referrer_id, 
                        'influencer_bounty', 
                        v_bounty, 
                        'conversion:' || NEW.id,
                        jsonb_build_object('referred_user_id', NEW.id)
                    );
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Comentarios actualizados
COMMENT ON POLICY "service_only_influencer_configs" ON influencer_configs IS 'Solo accesible vía service_role desde el backend.';
