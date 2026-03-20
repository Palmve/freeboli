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

-- Vista para estadísticas globales del bot
CREATE OR REPLACE VIEW public.bot_stats AS
SELECT 
    COUNT(*) as total_trades,
    SUM(pnl) as total_pnl,
    SUM(fee) as total_fees,
    (SELECT SUM(sol_balance) FROM bot_wallets) as total_sol,
    (SELECT SUM(bolis_balance) FROM bot_wallets) as total_bolis,
    (SELECT SUM(usdt_balance) FROM bot_wallets) as total_usdt
FROM public.bot_trades;
