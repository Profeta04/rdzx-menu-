-- 1. Revogar a licença mestre do pirata
UPDATE public.licenses 
SET status = 'revoked',
    active = false,
    updated_at = now()
WHERE license_key = 'HYPER-7X741ESCWS3KTH6IN4RI';

-- 2. Invalidar todas as sessões ativas desta licença
UPDATE public.sessions
SET is_active = false,
    last_heartbeat = now()
WHERE license_id IN (
    SELECT id FROM public.licenses WHERE license_key = 'HYPER-7X741ESCWS3KTH6IN4RI'
);