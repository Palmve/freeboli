-- Ampliación para Bot v2: Tracking y Grid
CREATE TABLE IF NOT EXISTS public.bot_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES public.bot_wallets(id),
    pair TEXT NOT NULL, -- BOLIS/SOL, BOLIS/USDT
    side TEXT NOT NULL, -- BUY, SELL
    amount_in DECIMAL NOT NULL,
    amount_out DECIMAL NOT NULL,
    price DECIMAL NOT NULL,
    fee DECIMAL DEFAULT 0,
    pnl DECIMAL DEFAULT 0,
    tx_signature TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Campos adicionales para bot_wallets
ALTER TABLE public.bot_wallets 
ADD COLUMN IF NOT EXISTS sol_balance DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bolis_balance DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS usdt_balance DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_buy_price DECIMAL DEFAULT 0;

-- Función para obtener estadísticas del bot (RPC)
CREATE OR REPLACE FUNCTION public.get_bot_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_trades', COUNT(*),
        'total_pnl', COALESCE(SUM(pnl), 0),
        'total_fees', COALESCE(SUM(fee), 0),
        'total_sol', (SELECT COALESCE(SUM(sol_balance), 0) FROM bot_wallets),
        'total_bolis', (SELECT COALESCE(SUM(bolis_balance), 0) FROM bot_wallets),
        'total_usdt', (SELECT COALESCE(SUM(usdt_balance), 0) FROM bot_wallets)
    ) INTO result
    FROM public.bot_trades;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
