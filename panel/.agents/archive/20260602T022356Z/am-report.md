# Audit Report — Refresh Global da Memória do Projeto

> Gerado por Agent J (Synthesizer) — Wave 2 Final  
> Matéria-prima: 487 linhas de inboxes A–I + audit próprio J  
> Data: Wave 2 FINAL

---

## Executive Summary

- **Drift crítico de nomes no schema:** `license_keys` → `licenses`, `telegram_otp` → `admin_otp_codes`, `has_role()` → `is_admin()`. Qualquer memória que referencie os nomes antigos produz código quebrado imediatamente.
- **Dois hardcodings de segurança não documentados:** GROQ API key em plaintext no `extension/background.js` e HMAC secret em `extension/security.js` — ausentes da memória de segurança.
- **Extensão ext_src defasada 1 versão maior:** `public/ext_src/` em v6.2 vs `extension/` em v7.1.2; EXTENSION SYNC RULE violada. Adicionalmente, ext_src mistura arquivos Burp Lovable.
- **15 edge functions catalogadas — nenhuma usa `verify_jwt=true` exceto `bulk-license-ops`** — drift severo com qualquer memória que descreva autenticação padrão por JWT.
- **Design system tem 6 gaps reais** (--primary-glow ausente em light, body bg externa, float keyframe não registrado no Tailwind, etc.) que a memória de visual identity não captura.

---

## Findings por Subsistema

### Extensão HyperBuild (Agent A + B)

- **Nome real:** `HyperBuild` (manifest `name`). "Hyper RB" é nome antigo/informal — remover da memória.
- **Versão manifest:** `7.1.2` (extension/). Zips publicados vão até v6.9.4. Gap de ~1.1.x não publicado.
- **SYNC RULE violada:** `public/ext_src/manifest.json` = v6.2; `extension/manifest.json` = 7.1.2. 10 arquivos com hash diferente.
- **ext_src contém 8 arquivos `burp_*`** não presentes em `extension/` — mistura de escopos.
- **4 versões no mesmo codebase:** 7.1.2 (manifest), 6.9.0 (security.js), v6.9 (background.js), v7.0.8 (content.js).
- **GROQ API key hardcoded** em `extension/background.js:96` (plaintext no service worker).
- **HMAC secret hardcoded** em `extension/security.js:27` ("HyperbuildR3zxyPr0fet188290994567$&...!!!").
- Customize engine v4.0: 4 presets (original/redBlack/goldBlack/grayPremium), avatarUpload, 3D tilt, RGB border.
- License key format: `HYPER-XXXX-XXXX`; validação via edge `/vx`; hwFingerprint enviado junto.
- Build Tab do admin hardcoded para `/ext_build_v62/` — sem versionamento dinâmico.

### Burp Lovable Runtime (Agent C)

- **23 scripts** no `_registry.js` (IDs 1–23) — número real a registrar na memória.
- **Edges chamadas pelo runtime Burp:** `/ai`, `/burp`, `/heartbeat`, `/vx` (via chains).
- **fast_mode** é parâmetro de payload (chat-replay + ws-correlator), NÃO configuração de manifest.
- **`/burp` edge** chama `lovable.dev`, `lovable.app`, `supabase.co` via ALLOWED_HOST_PATTERNS; usa `buildRotatedHeaders()` para Lovable, UA Chromium estático para supabase.co.
- Replay persiste em `burp_requests` apenas quando `x-license-key` presente.
- Burp NÃO chama `/pc` nem `/ai` diretamente — canal paralelo de replay raw.
- **HOST_ALLOWLIST** em `_shared.js` inclui `groq.com` e `generativelanguage.googleapis.com`.
- `SUPABASE_ANON_KEY` hardcoded em `burp_background.js:11`; project ref = `cvbgrjauqjawrsyknhyj`.
- **scripts/ top-level (6 arquivos JS)** são distintos de `public/burp_src/scripts/` — sem duplicata.

### Web Admin UI (Agent D + E)

- **Abas reais do AdminDashboard:** licenses, sessions, resellers, packages, recharge, monitoring, burp, notifications, versions, extension, payments (11 abas; "pilantrinhas" = alias de monitoring/fraud).
- **ProtectedRoute:** guarda por `user_roles` table; race window se `checkAdminRole` falha silenciosamente → spinner eterno.
- **RechargeTokensTab** = stub completo (PIX placeholder "Em breve"), sem hook, sem backend.
- **useBurpReplay** NÃO chama edge `/burp` — faz fetch local de `/burp_src/*` e gera ZIP client-side.
- **use-burp.ts** chama via `supabase.functions.invoke("proxy-command")`.
- **Dois clientes Supabase divergentes:** `@/integrations/supabase/client` (usePresets) vs `@/lib/supabase` (outros hooks).
- Admin auth: 3 camadas: (1) Supabase email+senha, (2) edge `verify-admin-key`, (3) edge `admin-otp-send`/`admin-otp-verify` via Telegram — OTP só exigido se `hyper_login_fails >= 2`.
- Cache admin auth: `hyper_admin_auth` localStorage, TTL 15 min.
- `PRICE_PER_TOKEN = 40` BRL — pricing só em DB (`reseller_credit_packages`).
- Hooks admin: useLicenses, useSessions, useNotifications, useExtensionVersions, usePayments, useResellers, useUsers, usePackages, useHeaderMetrics — todos react-query; useAdminRealtime invalida caches via canal Supabase Realtime.

### Edges Auth/Admin/Reseller (Agent F)

- **OTP Telegram:** chat_id por-usuário em tabela `admin_telegram` — NÃO env var `TELEGRAM_ADMIN_CHAT_ID`. Único secret = `TELEGRAM_BOT_TOKEN`.
- **bulk-license-ops:** exige OTP verificado nos últimos 5 min (TTL=5min, MAX_ATTEMPTS=3, IP rate 5/15min).
- **rate IP em verify-admin-key:** 8 req/15min; retorna HTTP 200 mesmo quando rate_limited (inconsistente).
- **reseller-login:** reseta senha auth para `license_key` em todo login bem-sucedido + `listUsers()` sem paginação.
- **get-notifications / get-versions:** sem auth, sem rate-limit; retornam changelogs e file_paths publicamente.
- **fraud-alerts:** sem auth de caller — qualquer request pode acionar.
- **reseller-api:** auth por `x-api-token` SHA-256 (RPC `find_reseller_by_api_key_hash`), sem JWT.
- **RESELLER_API.md** documenta 8 endpoints; `/generate-trial` retorna 403 "decommissioned" (não removido da edge).
- Edges com verify_jwt=true: somente `bulk-license-ops`. Resto: false ou auth própria.
- RPCs usados: `sync_expired_licenses`, `get_admin_header_metrics`, `search_licenses_admin`.

### Edges Proxy/AI/Licença (Agent G)

- **15 edges catalogadas** (tabela completa no inbox G):
  `/ai`, `/burp`, `/cp`, `/dz`, `/gn`, `/gp`, `/gr`, `/gu`, `/gv`, `/op`, `/pc`, `/pp`, `/uf`, `/vx`, `/dev-proxy-test`
- **Modelo AI default:** `google/gemini-3-flash-preview`; whitelist de 6 actions.
- **Rate-limit /ai:** 30 req/min por IP; payload máx 32 KB; telemetria sampling 20%.
- **Proxy rotation (/pc):** ativa SOMENTE quando `license_key === DEV_LICENSE_KEY`. Usuários normais → fetch direto.
- **/dz viola DRY:** copia inline BROWSER_PROFILES, fetchWithRetry, mapLovableError, humanJitter de `_shared/lovable.ts`.
- **/pp (process-payment)** sem validateExtensionRequest (sem HMAC), sem rate-limit por IP.
- **/gn, /gp, /gv** totalmente públicos sem autenticação.
- **fast_mode** está em `/pc` (v1: true, v3: true, v4: ausente) — NÃO em `/ai`.
- **INVISIBLE_PREFIX** injetado server-side em `/pc`.
- **`/op`** usa GROQ_API_KEY (llama-3.3-70b) ou OPENAI_API_KEY (gpt-4o-mini) como fallback.
- Licença lifecycle: bind → takeover (cooldown 10min) → heartbeat (debounce 90s) → sessão → expiração → blacklist (2 keys hardcoded).

### Schema DB / RLS (Agent H)

- **33 tabelas públicas** confirmadas via psql.
- **Nomes corretos (vs memória incorreta):**
  - `licenses` (NÃO `license_keys`)
  - `admin_otp_codes` (NÃO `telegram_otp`)
  - `is_admin()` (NÃO `has_role()`)
- **76 RLS policies**; todas as tabelas têm RLS habilitado.
- **47 triggers** — `trg_audit_*` em quase todas → `fn_audit_trigger` → `admin_audit_log`.
- `request_nonces` e `admin_otp_codes`: "Deny all access" via RLS — acesso só por SECURITY DEFINER.
- GRANTs: apenas `sandbox_exec` como grantee — sem grants para `anon`/`authenticated`.
- Enums: `app_role` (admin|reseller|user), `license_status` (active|trial|expired|revoked).
- project_id: `cvbgrjauqjawrsyknhyj` (config.toml confirmado).

### Design System (Agent I)

- **Neon purple:** `286 100% 50%` = `#bf00ff` ✓ correto.
- **`.glass-card`** existe: `backdrop-filter: blur(24px) saturate(180%)` + webkit; hover eleva sombra neon.
- **Glassmorphism tokens OK** em `:root` e `.dark`.
- **Fonte:** Plus Jakarta Sans via Google Fonts com fallback `@font-face`.
- **6 gaps reais:**
  1. `--primary-glow` ausente em `:root` (light mode) — só em `.dark`
  2. Body background-image = URL externa hardcoded (pxfuel.com) — sem token, sem CSP allowlist
  3. `components.json baseColor = "slate"` — inconsistente com identidade neon-purple
  4. `ThemeProvider defaultTheme="dark"` sem toggle UI — light tokens existem mas inativos
  5. `--accent` no dark = cinza escuro (240 8% 14%), não neon — contraste fraco
  6. `float` keyframe definido em CSS mas não no bloco `keyframes` do Tailwind — `animate-float` só funciona via CSS raw
- `neon-glow`/`neon-glow-lg` existem em index.css mas **zero uso** em componentes auditados.
- BurpPresetsManager/BurpHistoryList usam `bg-card` sem `glass-card` — fora do padrão.

### Docs & Memória (Agent J)

- **README.md** = stub vazio ("TODO: Document your project here") — sem cobertura real.
- **`package.json name`** = `"vite_react_shadcn_ts"` — nunca atualizado; memória deve refletir `"hyperbuild"` ou similar.
- **`.lovable/plan.md`** = plano stale de fix glassmorphism (3 sub-agentes UI) — deve ser ignorado/purgado da memória arquitetural.
- **`public/llms.txt`** minimal (6 linhas) — só cita Home page; sem admin, extensão, reseller.
- **RESELLER_API.md** presente e coerente com a edge (8 endpoints, base URL `cvbgrjauqjawrsyknhyj.supabase.co`).
- **scripts/ top-level:** 6 arquivos JS independentes (action-classifier, chat-replay, e2e-decryptor, header-probe, sse-decoder, ws-correlator) — distintos de `public/burp_src/scripts/`.
- `vite.config.ts` serve `/ext_src` → `extension/` via regex — SYNC RULE não cumprida (B confirmou).
- `playwright.config.ts` usa wrapper `lovable-agent-playwright-config`; `src/test/setup.ts` referenciado pelo vitest.

---

## Drift vs Memória Atual (tabela)

| mem://path | Item na memória | Realidade | Ação |
|---|---|---|---|
| `mem://project/overview` | `name` provavelmente "Hyper RB" ou similar | `package.json name = "vite_react_shadcn_ts"`; produto chama-se **HyperBuild** | rewrite |
| `mem://extension/hyper-rb-architecture` | Nome "Hyper RB" | Nome real = **HyperBuild**; manifest v7.1.2 | rewrite |
| `mem://extension/hyper-rb-architecture` | Contagem de scripts (provavelmente ≠23) | **23 scripts** reais no _registry.js (IDs 1-23) | update |
| `mem://extension/hyper-rb-architecture` | fast_mode como config | fast_mode é **parâmetro de payload** (chat-replay/ws-correlator) | update |
| `mem://extension/hyper-rb-architecture` | Edges chamadas pela extensão | /ai, /burp, /heartbeat, /vx | update |
| `mem://architecture/backend` | Tabela `license_keys` | Tabela real = **`licenses`** | rewrite |
| `mem://architecture/backend` | Tabela `telegram_otp` | Tabela real = **`admin_otp_codes`** | rewrite |
| `mem://architecture/backend` | Função `has_role()` | Função real = **`is_admin()`**; role via `user_roles` table | rewrite |
| `mem://architecture/backend` | Modelo AI (Claude/GPT?) | AI edge usa **`google/gemini-3-flash-preview`**; /op usa Groq/OpenAI | rewrite |
| `mem://architecture/backend` | Proxy rotation para todos | Proxy só ativa para **`DEV_LICENSE_KEY`**; usuários normais = fetch direto | rewrite |
| `mem://architecture/backend` | 33 tabelas reais | Deve listar nomes reais confirmados via psql | update |
| `mem://auth/admin-otp-telegram` | `TELEGRAM_ADMIN_CHAT_ID` como env var global | chat_id por-usuário em tabela **`admin_telegram`**; só secret = `TELEGRAM_BOT_TOKEN` | rewrite |
| `mem://auth/admin-otp-telegram` | OTP sempre exigido no login | OTP só se `hyper_login_fails >= 2` | update |
| `mem://features/admin-dashboard` | Tabs do admin (lista desatualizada?) | 11 abas reais: licenses, sessions, resellers, packages, recharge, monitoring, burp, notifications, versions, extension, payments | update |
| `mem://features/admin-dashboard` | Gate OTP em bulk ops | bulk-license-ops exige OTP dos últimos 5 min | add |
| `mem://features/admin-dashboard` | RechargeTokens funcional | É **stub** (PIX "Em breve"), sem backend | update |
| `mem://features/extension-ui` | Versão da extensão | Versão real = **7.1.2**; zips publicados vão até 6.9.4 | update |
| `mem://features/extension-ui` | 4 presets customize | Confirmado: original/redBlack/goldBlack/grayPremium + avatarUpload + RGB border | ok/confirm |
| `mem://style/visual-identity` | Design system completo | 6 gaps: --primary-glow ausente em :root, bg externa, baseColor slate, dark-only theme, accent neutro, float keyframe não-tailwind | update |
| `mem://tech/promptx-secrets` | Secrets de AI | Secrets reais: `LOVABLE_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `DEV_LICENSE_KEY`, `INVISIBLE_PREFIX` (server-side em /pc) | rewrite |
| `mem://tech/promptx-secrets` | GROQ key só em /op | GROQ key também hardcoded em `extension/background.js:96` (plaintext) | add HIGH |
| `mem://workflow/task-master-v2` | .lovable/plan.md como plano ativo | Plano **stale** (glassmorphism fix 3 sub-agentes) — não é memória arquitetural | remove |

---

## Nova Estrutura de Memória Proposta

Os seguintes arquivos `mem://` devem existir após o refresh:

| Arquivo mem:// | Conteúdo (1 linha) |
|---|---|
| `mem://index.md` | Core index com links para todos abaixo; nome do produto = HyperBuild; project_id supabase; stack resumida |
| `mem://project/overview` | Nome HyperBuild, package.json name, monorepo structure, extensão v7.1.2, admin web React, edges Supabase |
| `mem://extension/hyperbuild-architecture` | Manifest v7.1.2, 4 presets, license format HYPER-XXXX, edges /vx /pc /ai /heartbeat /burp, 23 Burp scripts, security hardcodings |
| `mem://burp/runtime` | 23 scripts _registry, edges /ai+/burp+/heartbeat+/vx, fast_mode=payload, HOST_ALLOWLIST inclui Groq+Google |
| `mem://architecture/backend` | 15 edges, tabelas reais (licenses/admin_otp_codes/etc), 33 tabelas, 76 RLS, 47 triggers, RPCs, GRANTs sandbox_exec |
| `mem://architecture/edges-catalog` | Tabela das 15 edges com método/verify_jwt/secrets/rate-limit |
| `mem://auth/admin-flow` | 3 camadas: Supabase auth + verify-admin-key + OTP Telegram (se fails≥2); TTL 15min localStorage; bulk-ops gate OTP 5min |
| `mem://auth/admin-otp-telegram` | TELEGRAM_BOT_TOKEN único secret; chat_id em admin_telegram por user_id; TTL 5min; rate 5/15min IP |
| `mem://features/admin-dashboard` | 11 abas reais, hooks react-query, useAdminRealtime, RechargeTokens=stub, PRICE_PER_TOKEN=40 BRL |
| `mem://features/reseller-api` | 8 endpoints (generate-trial decommissioned), auth x-api-token SHA256, base URL cvbgrjauqjawrsyknhyj |
| `mem://style/visual-identity` | neon #bf00ff 286°, glass-card blur24+saturate180, 6 gaps conhecidos, dark-only real, fonts Plus Jakarta Sans |
| `mem://tech/secrets-and-keys` | Todos secrets: LOVABLE_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, DEV_LICENSE_KEY, INVISIBLE_PREFIX; hardcodings em extensão |
| `mem://security/findings` | GROQ hardcoded extension/background.js:96; HMAC hardcoded extension/security.js:27; /pp sem HMAC; /gn/gp/gv públicos; /dz DRY violation |

**Remover:**
- `mem://workflow/task-master-v2` (plano stale glassmorphism, não é memória arquitetural)
- Qualquer referência a `license_keys`, `telegram_otp`, `has_role()`, "Hyper RB" como nome oficial

---

## Recomendações Priorizadas

### High (segurança / funcionalidade quebrada)

1. **[SEC-H1]** Remover GROQ API key hardcoded de `extension/background.js:96` → usar variável de build/env injetada.
2. **[SEC-H2]** Remover HMAC secret hardcoded de `extension/security.js:27` → cofre de secrets ou build-time injection.
3. **[SCHEMA-H3]** Corrigir todas as referências de código/memória a `license_keys` → `licenses`, `telegram_otp` → `admin_otp_codes`, `has_role()` → `is_admin()`.
4. **[AUTH-H4]** Adicionar rate-limit e auth ao endpoint `fraud-alerts` (atualmente sem caller validation).
5. **[AUTH-H5]** Adicionar HMAC/rate-limit a `/pp` (process-payment) — atualmente sem validateExtensionRequest.

### Medium

6. **[SYNC-M1]** Sincronizar `public/ext_src/` com `extension/` (v6.2 → v7.1.2) para cumprir EXTENSION SYNC RULE.
7. **[RESELLER-M2]** Refatorar `reseller-login`: usar busca por email direta em vez de `listUsers()` sem paginação.
8. **[HTTP-M3]** `verify-admin-key` deve retornar HTTP 429 quando rate limited, não HTTP 200 com `rate_limited: true`.
9. **[AUTH-M4]** `get-notifications` / `get-versions` expõem changelogs publicamente — avaliar adicionar API key mínima.
10. **[UI-M5]** Corrigir ProtectedRoute: se `checkAdminRole` falha silenciosamente, exibir erro em vez de spinner eterno.
11. **[AI-M6]** Resolver duplicação de cliente Supabase: unificar imports para `@/integrations/supabase/client`.

### Low / Cleanup

12. **[DS-L1]** Definir `--primary-glow` em `:root` (light mode) para evitar undefined no Tailwind.
13. **[DS-L2]** Substituir URL externa do body background (pxfuel.com) por asset local ou CSS var.
14. **[DS-L3]** Registrar `float` keyframe no bloco `keyframes` do `tailwind.config.ts`.
15. **[DS-L4]** Auditar uso de `neon-glow`/`neon-glow-lg` — ou usar ou remover as classes.
16. **[BUILD-L5]** Dinamizar Build Tab do admin (atualmente hardcoded `/ext_build_v62/`).
17. **[DOCS-L6]** Preencher `README.md` com features reais do projeto.
18. **[DOCS-L7]** Atualizar `package.json name` de `"vite_react_shadcn_ts"` para nome real.
19. **[DOCS-L8]** Expandir `public/llms.txt` para cobrir admin, extensão, reseller.
20. **[DRY-L9]** Refatorar `/dz` para importar de `_shared/lovable.ts` em vez de duplicar inline.
21. **[BURP-L10]** Remover arquivos `burp_*` de `public/ext_src/` — mistura indevida de escopos.

---

## Apêndice: contagem por agente

| Agente | Findings H/M/L | Msgs no inbox | Linhas inbox |
|--------|---------------|---------------|--------------|
| A | 2H / 1M / 3L | 5 | ~52 |
| B | 0H / 2M / 2L | 3 | ~37 |
| C | 0H / 0M / 0L | 3 cross-refs | ~25 |
| D | 0H / 2M / 3L | 5 (incl cross-refs) | ~52 |
| E | 0H / 2M / 4L | 5 (incl 4 Outdated-Memory) | ~30 |
| F | 0H / 3M / 3L | 5 (incl cross-refs) | ~55 |
| G | 3H / 1M / 1L | 5 | ~61 |
| H | 0H / 0M / 3 drifts | 3 | ~65 |
| I | 0H / 1M / 6L | 1 + cross-ref | ~41 |
| J | 3H / 1M / 2L | 2 self + 4 received | ~69 |
| **Total** | **8H / 13M / 27L** | **37** | **~487** |

---

*Report finalizado — Wave 2 FINAL. Todos os OPENs endereçados a J foram drenados (ACK abaixo).*
