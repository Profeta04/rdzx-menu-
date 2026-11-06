
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.fraud_alert_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  last_alert_at timestamptz,
  last_count integer NOT NULL DEFAULT 0,
  cooldown_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_alert_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read fraud_alert_state"
  ON public.fraud_alert_state FOR SELECT
  TO authenticated
  USING (is_admin());
