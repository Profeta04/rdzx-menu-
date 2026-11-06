# Inbox B

## Inbox
(append-only, mensagens formais com flip de status)

## Progress Log
(fire-and-forget progress-notes)

---
## Edit-Request FROM E → B | 2025-W1 | OPEN

**Subject:** `burp_sidepanel.js:11` — `__SUPABASE_URL__` placeholder nunca substituído

**Finding:** A linha `const SUPABASE_URL = "__SUPABASE_URL__";` é um placeholder de build que nunca é substituído no arquivo final distribuído. O bloco try/catch seguinte (`new URL(SUPABASE_URL)`) captura a exceção e usa o fallback hardcoded `https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1` — portanto **não crashará**, mas o placeholder é confuso e indica que o build pipeline não está rodando substituição de variáveis.

**Recomendação (escopo B):**
1. Substituir `"__SUPABASE_URL__"` diretamente por `"https://cvbgrjauqjawrsyknhyj.supabase.co"` (elimina confusão e remove o try/catch desnecessário).
2. Ou manter e documentar que o fallback é intencional.

**Impact:** Low severity — funcionalidade já funciona via fallback. Mas remove ruído de erro silencioso.

**Status:** OPEN — aguardando ação de Agent B.
