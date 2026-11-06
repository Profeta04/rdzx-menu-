CREATE TABLE public.burp_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  method text NOT NULL DEFAULT 'POST',
  url_template text NOT NULL,
  headers_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_hb_license boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.burp_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read enabled presets"
  ON public.burp_presets FOR SELECT
  USING (enabled = true);

CREATE POLICY "Admins can read all presets"
  ON public.burp_presets FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert presets"
  ON public.burp_presets FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update presets"
  ON public.burp_presets FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete presets"
  ON public.burp_presets FOR DELETE
  TO authenticated
  USING (is_admin());

CREATE TRIGGER update_burp_presets_updated_at
  BEFORE UPDATE ON public.burp_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.burp_presets (slug, name, description, method, url_template, headers_template, body_template, sort_order, requires_hb_license) VALUES
('lovable-chat-direct', 'Chat Direto Lovable', 'Envia mensagem direta para o chat de um projeto Lovable', 'POST',
  'https://api.lovable.dev/projects/{projectId}/chat',
  '{"content-type":"application/json","authorization":"Bearer {lovableToken}"}'::jsonb,
  '{"message":"{message}","images":[],"optimisticImageUrls":[],"files":[],"chat_only":false,"plan_mode":false,"READ_ONLY":false,"thread_id":null,"intent":null,"use_tools":true,"should_create_plan":false,"fast_mode":true}'::jsonb,
  10, false),
('lovable-pc-proxy', 'Proxy /pc (Edge Function)', 'Envia chat via Edge Function pc usando licença HyperBuild', 'POST',
  '{supabaseUrl}/functions/v1/pc',
  '{"content-type":"application/json","authorization":"Bearer {supabaseAnonKey}","apikey":"{supabaseAnonKey}","x-license-key":"{hbLicense}","x-device-id":"{deviceId}"}'::jsonb,
  '{"license_key":"{hbLicense}","device_id":"{deviceId}","projeto_id":"{projectId}","mensagem":"{message}","fast_mode":true,"files":[]}'::jsonb,
  20, true);