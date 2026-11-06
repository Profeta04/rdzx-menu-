-- ai_usage_logs: telemetria da edge function /ai
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok',
  ip text,
  license_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Admins leem tudo; service role escreve via edge function (RLS bypass).
CREATE POLICY "Admins read ai_usage_logs"
  ON public.ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_action ON public.ai_usage_logs (action);

-- burp_presets: coluna `kind` p/ separar request × chain (Bloco C)
ALTER TABLE public.burp_presets
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'request';

ALTER TABLE public.burp_presets
  DROP CONSTRAINT IF EXISTS burp_presets_kind_check;

ALTER TABLE public.burp_presets
  ADD CONSTRAINT burp_presets_kind_check
  CHECK (kind IN ('request', 'chain'));

CREATE INDEX IF NOT EXISTS idx_burp_presets_kind ON public.burp_presets (kind);