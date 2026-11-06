INSERT INTO public.burp_presets (
  slug, name, description, method, url_template,
  headers_template, body_template,
  requires_hb_license, enabled, sort_order, kind
) VALUES (
  'lovable-chat-qa-finding-fix',
  'Lovable · QA Finding Fix (Security tab)',
  'Reproduz o botão "Try to fix" da aba Security do Lovable. Usa intent qa_finding_fix com message_intent_metadata.finding_fix_metadata. Requer {{FINDING_ID}} (capturado automaticamente pelo Hyper RB v4.3.0 quando você navega na aba Security ou clica em qualquer Try to fix).',
  'POST',
  'https://api.lovable.dev/projects/{{PROJECT_ID}}/chat',
  '{"Content-Type":"application/json","Authorization":"Bearer {{LOVABLE_TOKEN}}"}'::jsonb,
  '{
    "message": "Fix the security finding.",
    "intent": "qa_finding_fix",
    "message_intent_metadata": {
      "finding_fix_metadata": {
        "title": "Security finding",
        "health_check_finding_id": "{{FINDING_ID}}",
        "summary": "Apply remediation for the captured security finding.",
        "severity": "error",
        "evidence": "Captured via Hyper RB."
      }
    },
    "plan_mode": false,
    "thread_id": "main",
    "use_tools": true,
    "should_create_plan": false,
    "READ_ONLY": false,
    "chat_only": false,
    "files": [],
    "images": [],
    "optimisticImageUrls": []
  }'::jsonb,
  false,
  true,
  25,
  'request'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  method = EXCLUDED.method,
  url_template = EXCLUDED.url_template,
  headers_template = EXCLUDED.headers_template,
  body_template = EXCLUDED.body_template,
  enabled = EXCLUDED.enabled,
  sort_order = EXCLUDED.sort_order,
  kind = EXCLUDED.kind,
  updated_at = now();