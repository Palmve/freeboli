-- 021: Security Events Management (Status & Resolution)

ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed'));
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS resolution_comment TEXT;

-- Permitir omitir el límite de frecuencia de retiros manualmente
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS withdraw_limit_override_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_security_events_status ON public.security_events(status);
