-- Tabla para gestionar las wallets del bot
CREATE TABLE IF NOT EXISTS public.bot_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_key TEXT UNIQUE NOT NULL,
    private_key TEXT NOT NULL, 
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used TIMESTAMPTZ
);

-- Habilitar RLS para bot_wallets (solo admin)
ALTER TABLE public.bot_wallets ENABLE ROW LEVEL SECURITY;
-- Ajustar políticas según roles o lista blanca

-- Configuraciones iniciales en site_settings
INSERT INTO public.site_settings (key, value) VALUES 
('BOT_ENABLED', 'false'),
('BOT_MIN_INTERVAL', '1'),
('BOT_MAX_INTERVAL', '4'),
('BOT_MIN_AMOUNT', '1000'), 
('BOT_MAX_AMOUNT', '5000'),
('BOT_NEXT_RUN', '"2026-03-20T00:00:00Z"'),
('BOT_SOL_POOL_ID', '"AdtP1DJCsfEHs4dc7224n67eJTgxAWHzJ8W7GWtjgWE8"'),
('BOT_USDT_POOL_ID', '"GD5rMeg2ny7Q9qJTnfFGjLFEPTke1sG7ahhbXDFPX2EL"')
ON CONFLICT (key) DO NOTHING;
