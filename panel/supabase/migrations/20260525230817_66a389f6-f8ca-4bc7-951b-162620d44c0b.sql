DELETE FROM public.burp_presets WHERE slug IN (
  'pc-chat','pc-remove-wm','lovable-pc-proxy',
  'cp-create','uf-upload','op-optimize',
  'vx-validate','heartbeat','gn','gp','gv','gu','gr','pp','burp-replay'
);

INSERT INTO public.burp_presets
  (slug, name, description, method, url_template, headers_template, body_template, requires_hb_license, enabled, sort_order)
VALUES
  ('lovable-chat',
   'Lovable · Chat (upstream do /pc)',
   'POST direto em api.lovable.dev/projects/{projectId}/chat — mesmo request que a edge /pc faz.',
   'POST', 'https://api.lovable.dev/projects/{projectId}/chat',
   '{"Content-Type":"application/json","Authorization":"Bearer {{LOVABLE_TOKEN}}"}'::jsonb,
   '{"mensagem":"olá","fast_mode":true,"files":[]}'::jsonb,
   false, true, 10),
  ('lovable-create-project',
   'Lovable · Criar projeto (upstream do /cp)',
   'POST direto em api.lovable.dev/workspaces/{workspaceId}/projects.',
   'POST', 'https://api.lovable.dev/workspaces/{workspaceId}/projects',
   '{"Content-Type":"application/json","Authorization":"Bearer {{LOVABLE_TOKEN}}"}'::jsonb,
   '{"name":"novo-projeto","prompt":"landing page minimal"}'::jsonb,
   false, true, 20),
  ('lovable-generate-upload-url',
   'Lovable · Upload URL (upstream do /uf)',
   'Gera URL pré-assinada para upload.',
   'POST', 'https://api.lovable.dev/projects/{projectId}/files/generate-upload-url',
   '{"Content-Type":"application/json","Authorization":"Bearer {{LOVABLE_TOKEN}}"}'::jsonb,
   '{"fileName":"image.png","contentType":"image/png"}'::jsonb,
   false, true, 40),
  ('lovable-generate-download-url',
   'Lovable · Download URL',
   'Gera URL pré-assinada para download.',
   'POST', 'https://api.lovable.dev/files/generate-download-url',
   '{"Content-Type":"application/json","Authorization":"Bearer {{LOVABLE_TOKEN}}"}'::jsonb,
   '{"fileId":"{{FILE_ID}}"}'::jsonb,
   false, true, 50),
  ('groq-chat-completions',
   'Groq · Chat completions (upstream do /op e do AI client)',
   'POST direto na Groq API — mesmo endpoint usado pelo HyperBuild.',
   'POST', 'https://api.groq.com/openai/v1/chat/completions',
   '{"Content-Type":"application/json","Authorization":"Bearer {{GROQ_API_KEY}}"}'::jsonb,
   '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"Olá"}],"temperature":0.2}'::jsonb,
   false, true, 60)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  method = EXCLUDED.method,
  url_template = EXCLUDED.url_template,
  headers_template = EXCLUDED.headers_template,
  body_template = EXCLUDED.body_template,
  requires_hb_license = EXCLUDED.requires_hb_license,
  enabled = EXCLUDED.enabled,
  sort_order = EXCLUDED.sort_order;