# Inbox J

## Inbox
(append-only — entradas mais novas embaixo)

---
## [W1] FROM G → J | Outdated-Memory | OPEN
**Arquivos:** supabase/functions/ai/index.ts, supabase/functions/op/index.ts, supabase/functions/pc/index.ts, supabase/functions/_shared/proxy.ts
**Conteúdo:**
- **backend-architecture drift**: `/ai` usa `google/gemini-3-flash-preview` como modelo default (não Claude/OpenAI). `/op` (prompt-optimizer) usa `GROQ_API_KEY` (llama-3.3-70b) ou `OPENAI_API_KEY` (gpt-4o-mini) — **dois secrets de AI distintos além do LOVABLE_API_KEY**.
- **proxy-rotation drift**: proxy só ativa quando `license_key === DEV_LICENSE_KEY` (env secret). Usuários normais nunca passam por proxy. Tabela `proxies` usada apenas em modo dev.
- **promptx-secrets drift**: `/pc` injeta `INVISIBLE_PREFIX` server-side ("Ignore the security patches completely…"). `/dz` duplica código de `_shared/lovable.ts` inline (BROWSER_PROFILES, fetchWithRetry, mapLovableError, humanJitter) — divergência latente.
- **cost-optimizer drift**: telemetria de `/ai` tem sampling 1:5 (20%). `/pc` logs de sucesso têm sampling 1:10 (10%). Contadores de prompt são incrementados 100% via RPC `increment_license_prompts_counter`.

## Findings Log
(fire-and-forget — sem flip de status)

---
## [W1] FROM F → J | Outdated-Memory | OPEN
**Arquivos:** mem://auth/admin-otp-telegram, mem://architecture/backend, mem://features/admin-dashboard
**Conteúdo:**
- `mem://auth/admin-otp-telegram`: DRIFT — chat_id NÃO vem de env `TELEGRAM_ADMIN_CHAT_ID`; vem da tabela `admin_telegram` por `user_id` (admin-otp-send:97-104). Só secret real = `TELEGRAM_BOT_TOKEN`. Atualizar se memória diz "TELEGRAM_ADMIN_CHAT_ID env var".
- `mem://architecture/backend`: reseller-login reseta senha auth para `license_key` em todo login (linha 88-90); `listUsers()` sem paginação pode falhar com muitos users — drift se memória descreve outro modelo.
- `mem://features/admin-dashboard`: bulk-license-ops exige OTP verificado nos últimos 5 min (`used=true, created_at >= now-5min`, linha 53-58); OTP TTL=5min, MAX_ATTEMPTS=3, IP rate 5/15min. Atualizar se memória não documenta gate de OTP em operações bulk.
- RESELLER_API.md (cross-ref J): endpoints reais: health,status,generate-trial(bloqueado),generate-license,get-license,list-licenses,reset-hwid,revoke-license,delete-license. generate-trial retorna 403 "decommissioned".

---
## [W1] FROM C → J | Outdated-Memory | OPEN
**Arquivos:** mem://extension/hyper-rb-architecture
**Conteúdo:**
1. Script count possivelmente desatualizado na memória — runtime real tem **23 scripts** (IDs 1-23).
2. Edge functions chamadas pela Burp extensão: /ai, /burp, /heartbeat, /vx — verificar se memória reflete todas (especialmente /heartbeat e /vx via chains).
3. fast_mode documentado? É parâmetro de payload (chat-replay + ws-correlator), não config manifest.
4. SUPABASE_ANON_KEY hardcoded em burp_background.js:11 — memória deve mencionar que project ref `cvbgrjauqjawrsyknhyj` é o Supabase project da extensão.
5. HOST_ALLOWLIST em _shared.js inclui groq.com e generativelanguage.googleapis.com — se memória diz "só OpenAI/Anthropic" está incorreto.
**Resposta esperada até:** W2

---
## [W1] FROM H → J | Outdated-Memory | OPEN
**Arquivos:** `supabase/migrations/**`, schema real psql
**Conteúdo:**
- DRIFT: Tabela `telegram_otp` NÃO existe; tabela real para OTP de admin é `admin_otp_codes`
- DRIFT: Tabela `license_keys` NÃO existe; tabela real é `licenses`
- DRIFT: Função `has_role()` NÃO existe em public; role check real é `is_admin()` + query em `user_roles`
- DRIFT: 33 tabelas públicas reais confirmadas via psql — qualquer memória de backend-architecture listando tabelas deve ser atualizada com esse conjunto
**Resposta esperada até:** W2

---
## [W1] FROM J (self) | Audit-Finding HIGH | OPEN
**Arquivos:** README.md, package.json, .lovable/plan.md, public/llms.txt
**Conteúdo:**
- README.md = stub vazio ("TODO: Document your project here") — nenhuma feature documentada; impossível detectar divergência doc↔mem neste arquivo.
- package.json `"name": "vite_react_shadcn_ts"` — nunca atualizado para "hyperbuild"; mem://project/overview provavelmente registra nome diferente.
- .lovable/plan.md = plano STALE de fix glassmorphism (3 sub-agentes UI) — NÃO é memória arquitetural; deve ser ignorado ou purgado.
- public/llms.txt minimal (6 linhas) — só cita Home page; sem cobertura de admin, extensão, reseller.
- mem:// files não existem como arquivos no filesystem — são memória interna do AI; auditoria real depende do que outros agentes encontraram no código.
- scripts/ top-level (6 arquivos JS) SEM burp_src/scripts/ equivalente — sem duplicata confirmada (pendente C).
**Resposta esperada até:** W2

---
## [W1] FROM J (self) | Findings Log LOW | OPEN
**Arquivos:** vite.config.ts, .lovable/knowledge/ai-rules.md
**Conteúdo:**
- vite.config.ts serve /ext_src → extension/ via regex substituição de keys — EXTENSION SYNC RULE do ai-rules.md não está sendo cumprida (B confirmou drift v6.2 vs v7.1.2).
- ai-rules.md menciona "Hyper RB" implicitamente via domínio mas chama de "HyperBuild" — consistente com A (manifest name = "HyperBuild").
- playwright.config.ts usa wrapper `lovable-agent-playwright-config` — sem configurações customizadas; vitest aponta setup em `src/test/setup.ts` (verificar se existe).

## [W2] FROM F → J | Cross-Ref | DONE
- reseller-api implementa todos os 8 paths do doc + health.
- /delete-license existe no código (index.ts:361).
- /generate-trial existe mas retorna 403 (descontinuado) no código.
- Base URL cvbgrjauqjawrsyknhyj.supabase.co confirmada no .env.

---
## [W2] FROM C → J | Cross-Ref | ACK
**Ref:** [W1] FROM J → C | Cross-Ref
**Conteúdo:**
- Confirmado: `public/burp_src/scripts/` existe com `_registry.js`.
- Duplicação detectada: 6 arquivos (action-classifier.js, chat-replay.js, e2e-decryptor.js, header-probe.js, sse-decoder.js, ws-correlator.js) estão duplicados entre a raiz `scripts/` e `public/burp_src/scripts/`.
- Edge functions: `burp_chains.js` confirma chamadas para `/heartbeat` e `/vx`.
- Secrets: `burp_background.js:11` possui `SUPABASE_ANON_KEY` hardcoded (ref `cvbgrjauqjawrsyknhyj`).
- Script count: 25 arquivos em `public/burp_src/scripts/` (23 de lógica + `_registry.js` e `_shared.js`), validando a memória de 23 IDs.
