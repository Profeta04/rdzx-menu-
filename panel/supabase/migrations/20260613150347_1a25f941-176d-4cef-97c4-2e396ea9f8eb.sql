
-- Recompacta admin_audit_log: 60MB de bloat -> tabela limpa preservando dados
BEGIN;

-- Purge agressivo (mantém 7 dias) antes de copiar
DELETE FROM public.admin_audit_log WHERE created_at < now() - interval '7 days';

-- Cria tabela nova com mesmo schema
CREATE TABLE public.admin_audit_log_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_user_id uuid,
  admin_email text,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id text,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text
);

INSERT INTO public.admin_audit_log_new
  SELECT id, created_at, admin_user_id, admin_email, action, target_table, target_id, diff, ip_address, user_agent
  FROM public.admin_audit_log;

DROP TABLE public.admin_audit_log CASCADE;
ALTER TABLE public.admin_audit_log_new RENAME TO admin_audit_log;

-- Índice para o purge job + queries por data
CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX idx_admin_audit_log_target ON public.admin_audit_log (target_table, created_at DESC);

-- GRANTs (obrigatórios após CREATE TABLE)
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

-- RLS + policy (mesma que existia)
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;
