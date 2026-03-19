-- 013: Support System (Tickets & Telegram)

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_email TEXT, -- Para usuarios no logueados o referencia rápida
    type TEXT NOT NULL, -- 'dispute', 'delay', 'error', 'other'
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'resolved', 'closed'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

-- Configuración de Telegram en site_settings
INSERT INTO public.site_settings (key, value) VALUES
  ('TELEGRAM_BOT_TOKEN', '""'),
  ('TELEGRAM_CHAT_ID', '""')
ON CONFLICT (key) DO NOTHING;
