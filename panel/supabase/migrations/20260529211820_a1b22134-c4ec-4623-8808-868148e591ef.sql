-- =========================================================================
-- Onda 2: índices em FKs + drop de índices duplicados/zumbis + cron jobs +
-- one-shot VACUUM FULL para tabelas inchadas.
-- =========================================================================

-- 1) Índices em FKs públicas faltantes (elimina seq scans)
CREATE INDEX IF NOT EXISTS idx_payments_reseller_id
  ON public.payments(reseller_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_reseller_id
  ON public.usage_logs(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_api_logs_reseller_id
  ON public.reseller_api_logs(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_credit_transactions_reseller_id
  ON public.reseller_credit_transactions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_credit_transactions_package_id
  ON public.reseller_credit_transactions(package_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id
  ON public.security_logs(user_id);

-- 2) Drop de índices duplicados (mantém a versão unique do par)
DROP INDEX IF EXISTS public.idx_licenses_key;
DROP INDEX IF EXISTS public.idx_resellers_user_id;
DROP INDEX IF EXISTS public.idx_security_bans_type_value;
DROP INDEX IF EXISTS public.idx_fraud_events_ip;
DROP INDEX IF EXISTS public.idx_request_nonces_nonce;
DROP INDEX IF EXISTS public.idx_request_nonces_nonce_unique;

-- 3) Drop de índices nunca lidos (0 reads, só amplificam escrita)
DROP INDEX IF EXISTS public.idx_burp_presets_kind;
DROP INDEX IF EXISTS public.idx_proxies_active;
DROP INDEX IF EXISTS public.idx_ai_usage_logs_action;
DROP INDEX IF EXISTS public.idx_user_roles_user;
DROP INDEX IF EXISTS public.idx_heartbeats_license;
DROP INDEX IF EXISTS public.idx_licenses_fraud_score;
DROP INDEX IF EXISTS public.idx_licenses_force_logout_at;
DROP INDEX IF EXISTS public.idx_reseller_features_reseller;
DROP INDEX IF EXISTS public.idx_request_nonces_created_at;

-- 4) Garantir extensão pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

-- 5) Cron jobs idempotentes (drop + recreate)
DO $$
DECLARE
  jid bigint;
BEGIN
  -- cleanup_stale_sessions a cada 2 minutos (tira esse trabalho do hot path do /vx)
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'cleanup-stale-sessions-2min' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
  PERFORM cron.schedule(
    'cleanup-stale-sessions-2min',
    '*/2 * * * *',
    $cron$ SELECT public.cleanup_stale_sessions(); $cron$
  );

  -- Purges diários (retenção 30d): admin_audit_log, usage_logs, etc.
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'run-maintenance-purges-daily' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
  PERFORM cron.schedule(
    'run-maintenance-purges-daily',
    '30 3 * * *',
    $cron$ SELECT public.run_maintenance_purges(); $cron$
  );

  -- VACUUM FULL one-shot daqui a ~2 minutos. O próprio job se autoremove.
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'vacuum-bloated-tables-once' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
  PERFORM cron.schedule(
    'vacuum-bloated-tables-once',
    '*/2 * * * *',
    $cron$
      VACUUM (FULL, ANALYZE) public.admin_audit_log;
      VACUUM (FULL, ANALYZE) public.resellers;
      VACUUM (FULL, ANALYZE) public.rate_limits_license;
      VACUUM (FULL, ANALYZE) public.usage_logs;
      SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'vacuum-bloated-tables-once';
    $cron$
  );
END $$;