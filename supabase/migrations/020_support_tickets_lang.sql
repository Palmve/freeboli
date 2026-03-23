-- 020: Add lang to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'es';
