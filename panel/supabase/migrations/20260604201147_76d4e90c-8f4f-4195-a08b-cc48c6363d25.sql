UPDATE public.burp_presets
SET
  name = 'Lovable · Health Check Finding Fix',
  description = 'Dispara o fluxo real "Try to fix" da aba Security do Lovable usando os finding_ids capturados pela Hyper RB.',
  url_template = 'https://api.lovable.dev/projects/{{PROJECT_ID}}/chat',
  method = 'POST',
  headers_template = jsonb_build_object(
    'Content-Type', 'application/json',
    'Accept', 'application/json',
    'Authorization', 'Bearer {{LOVABLE_TOKEN}}'
  ),
  body_template = jsonb_build_object(
    'message', 'Fix the captured Lovable health-check finding(s).',
    'intent', 'HEALTH_CHECK_FINDING_FIX',
    'source', 'health_check_brief',
    'thread_id', 'main',
    'chat_only', false,
    'plan_mode', false,
    'READ_ONLY', false,
    'use_tools', true,
    'should_create_plan', false,
    'files', '[]'::jsonb,
    'images', '[]'::jsonb,
    'optimisticImageUrls', '[]'::jsonb,
    'message_intent_metadata', jsonb_build_object(
      'health_check_finding_fix_metadata', jsonb_build_object(
        'finding_ids', to_jsonb('{{FINDING_IDS}}'::text),
        'title', 'Hyper RB · Health Check Fix'
      )
    )
  ),
  updated_at = now()
WHERE slug = 'lovable-chat-qa-finding-fix';