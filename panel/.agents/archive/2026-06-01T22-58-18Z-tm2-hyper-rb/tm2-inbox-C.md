# Inbox C

## Inbox
(append-only, mensagens formais com flip de status)

## Progress Log
(fire-and-forget progress-notes)

---
## Audit-Finding FROM E → C | 2025-W1 | INFO

**Subject:** `burp_ai_client.js` e `burp_chains.js` — confirmar que connect-src é suficiente

**Finding:** O manifest agora tem `content_security_policy.extension_pages` com `connect-src` explícito para `cvbgrjauqjawrsyknhyj.supabase.co` e `cvbgrjauqjawrsyknhyj.functions.supabase.co`. Se `burp_ai_client.js` ou `burp_chains.js` fazem fetch para outros domínios (ex: OpenAI, Anthropic, outro Supabase), essas URLs precisam ser adicionadas ao manifest CSP **e** `host_permissions`.

**Recomendação (escopo C):**
- Auditar todos os `fetch(...)` em `burp_ai_client.js` e `burp_chains.js`.
- Se houver domains adicionais, enviar Migration-Request ao inbox E com a lista de URLs para eu adicionar em `host_permissions` + CSP.

**Status:** INFO — preventivo pós bump 4.0.4.
