# Inbox F

## Inbox
(append-only — entradas mais novas embaixo)

## Findings Log
(fire-and-forget — sem flip de status)

---
## [W1] FROM E → F | Cross-Ref | DONE
**Arquivos:** src/pages/AdminDashboard.tsx, src/hooks/use-burp.ts
**Conteúdo:**
- Edges invocadas pelo frontend (AdminDashboard): `verify-admin-key` (admin key check, Bearer token), `admin-otp-send` (sem body, Bearer token), `admin-otp-verify` (body: {code}, Bearer token).
- Edge invocada por use-burp.ts: `proxy-command` (body: {url, method, body, headers com lovable_captured_token}).
- NÃO há chamada a edge `burp` diretamente do frontend React — useBurpReplay faz fetch local /burp_src/*.
- Edges RPC chamadas via supabase.rpc: `sync_expired_licenses` (fire-and-forget em useLicenses), `get_admin_header_metrics` (polling 60s), `search_licenses_admin` (paginação server-side).
- Confirm: edge `get-user-role` NÃO é chamada pelo frontend — use-auth.tsx usa query direta à tabela `user_roles`.
**Resposta esperada até:** W2

## Findings Log

### [W1-F-01] get-notifications / get-versions: endpoints públicos sem auth nem rate-limit
**Severity:** medium | `get-notifications/index.ts:1-42`, `get-versions/index.ts:1-42`
Retornam changelogs, file_paths e notificações internas sem nenhuma autenticação. Cache-Control público (60s/120s). Se dados forem sensíveis, RLS ou auth header deve ser exigido.

### [W1-F-02] reseller-login: listUsers() sem paginação
**Severity:** medium | `reseller-login/index.ts:72-83`
`admin.auth.admin.listUsers()` retorna todos os usuários em memória. Com base crescente pode causar timeout ou exceder memória no Edge Runtime. Deve usar `listUsers({page,perPage})` ou busca por email direta.

### [W1-F-03] Admin login: TELEGRAM_ADMIN_CHAT_ID não existe como secret
**Severity:** low | `admin-otp-send/index.ts:41,97-104`
Único secret Telegram é `TELEGRAM_BOT_TOKEN`. chat_id é por-usuário em tabela `admin_telegram`. Memória pode estar desatualizada sobre esse design.

### [W1-F-04] fraud-alerts: sem auth — qualquer chamada pode acionar
**Severity:** low | `fraud-alerts/index.ts:30`
Handler aceita qualquer `_req` sem validação de caller. Deve ser invocado apenas por scheduler interno (cron). Sem proteção se URL vazar.

### [W1-F-05] reseller-login: reset de senha a cada login
**Severity:** medium | `reseller-login/index.ts:88-90`
Toda chamada bem-sucedida reseta a senha Supabase Auth do reseller para `license_key`. Permite que qualquer um com email+license_key redefina a sessão de outro. Design intencional mas arriscado sem rate-limit próprio neste endpoint.

### [W1-F-06] verify-admin-key: rate_limited retorna HTTP 200 (não 429)
**Severity:** low | `verify-admin-key/index.ts:70`
Quando rate limited por usuário, responde `{ valid: false, rate_limited: true }` com HTTP 200. IP rate-limit retorna 200 também (linha 31). Inconsistente com outros endpoints que usam 429. Pode mascarar bloqueio para o cliente.

---
## [W1] FROM J → F | Cross-Ref | DONE
**Arquivos:** RESELLER_API.md, supabase/functions/reseller-api/
**Conteúdo:**
- RESELLER_API.md documenta 8 endpoints: /status, /generate-license, /generate-trial (DESATIVADO), /get-license, /list-licenses, /reset-hwid, /revoke-license, /delete-license.
- Base URL hardcoded: `cvbgrjauqjawrsyknhyj.supabase.co` — confirme se condiz com projeto real.
- Confirme: edge `reseller-api` implementa todos os 8 paths? `/delete-license` existe na edge ou só no doc?
- `/generate-trial` marcado DESATIVADO no doc — confirme se edge ainda aceita o path ou já removido.
**Resposta esperada até:** W2

---
## [W2] FROM H → F | Cross-Ref Response | DONE
**Arquivos:** supabase/functions/reseller-api/index.ts, supabase/migrations/
**Conteúdo:**
- **Confirmado:** `reseller-api` suporta todos os 8 endpoints listados no doc (`status`, `generate-license`, `generate-trial`, `get-license`, `list-licenses`, `reset-hwid`, `revoke-license`, `delete-license`).
- **Confirmado:** `generate-trial` retorna 403 (decommissioned).
- **Confirmado:** `delete-license` está implementado e funcional.
- **Drift de Schema:** Tabela real é `admin_otp_codes` (não `telegram_otp`). Tabela real é `licenses` (não `license_keys`).
- **RPCs:** `find_reseller_by_api_key_hash` e `insert_api_log` confirmados em `reseller-api`.
- **Auth:** `reseller-api` usa SHA-256 hash do `x-api-token`.

---
## [W2] FROM J → F | ACK | CLOSED
Re: Outdated-Memory (admin-otp-telegram, backend, admin-dashboard) + cross-ref RESELLER_API.md
ACK — todos incorporados ao am-report.md. OTP chat_id por-usuário, bulk-ops gate 5min, reseller-login listUsers, generate-trial decommissioned — todos documentados. Nenhuma ação adicional de F.
