# Inbox H

## Inbox
(append-only — entradas mais novas embaixo)

## Findings Log
(fire-and-forget — sem flip de status)

---
## [W1] FROM F → H | Cross-Ref | DONE
**Arquivos:** supabase/functions/{admin-otp-send,admin-otp-verify,verify-admin-key,bulk-license-ops,reseller-api,reseller-login,get-user-role,get-license-user,get-notifications,get-versions,heartbeat}/index.ts
**Conteúdo:**
- verify_jwt via `supabaseAuth.auth.getUser()`: admin-otp-send ✓, admin-otp-verify ✓, verify-admin-key ✓, bulk-license-ops ✓
- reseller-api: sem JWT — auth por `x-api-token` SHA-256 hashed (RPC `find_reseller_by_api_key_hash`)
- reseller-login: endpoint aberto (email+license_key), sem JWT — chama `listUsers()` sem paginação → risco performance/timeout com muitos users
- get-user-role, get-license-user: sem JWT, auth por `x-license-key` header + device_id
- get-notifications, get-versions, heartbeat, fraud-alerts: SEM AUTH / SEM rate-limit → confirmar se RLS ou policy cobre; get-notifications/get-versions expõem changelogs/file_paths publicamente
- Confirmar migrations: tabelas `admin_telegram`, `admin_otp_codes`, `admin_credentials`, `resellers`, `fraud_alert_state`, `reseller_api_logs`, RPCs `find_reseller_by_api_key_hash`, `check_rate_limit`, `check_rate_limit_ip`, `insert_api_log`, `force_remote_logout`

---
## [W1] H — Audit Schema Report | READ-ONLY

### config.toml
- project_id: `cvbgrjauqjawrsyknhyj`
- verify_jwt=false: `burp`, `reseller-login`, `download-project-zip`, `fraud-alerts`, `dev-proxy-test`
- verify_jwt=true: `bulk-license-ops`

### Tabelas reais (33 total) — confirmadas via psql
auth, admin, licenses, burp, ai, fraud, reseller, security, sessions, profiles, extension, packages, proxies, notifications, heartbeats, payments, usage_logs

### Tabelas mencionadas no escopo que NÃO existem no banco real
- `telegram_otp` → NÃO existe (existe `admin_otp_codes`)
- `license_keys` → NÃO existe (existe `licenses`)

### Enums
- `app_role`: admin | reseller | user
- `license_status`: active | trial | expired | revoked

### Functions notáveis
- `is_admin()` — existe (sem args, usa auth.uid interno)
- `has_role()` — NÃO existe; código que referenciar isso vai falhar
- 57 funções públicas; purge/maintenance, rate_limit, fraud, reseller credit, audit

### Triggers (47)
- `trg_audit_*` em quase todas as tabelas → `fn_audit_trigger` → `admin_audit_log`
- `trigger_limit_single_session` em sessions (BEFORE INSERT/UPDATE)
- `tr_handle_license_activation`, `tr_deduct_reseller_credit` em licenses

### RLS
- 76 policies; todas as tabelas têm RLS habilitado
- `request_nonces`: "Deny all access" — acesso apenas via funções SECURITY DEFINER
- `admin_otp_codes`: "No direct access" — idem

### GRANTs
- Apenas `sandbox_exec` aparece como grantee (INSERT+SELECT em todas as tabelas)
- Sem grants para `anon` ou `authenticated` — acesso via RLS policies + service role nas edge fns

### Findings para J (Outdated-Memory)
- `telegram_otp` inexistente; deve ser corrigido para `admin_otp_codes`
- `has_role()` inexistente; role check real é via `user_roles` tabela ou `is_admin()`
- `license_keys` nome errado; tabela real = `licenses`

### Cross-Ref
- Nenhuma edge function encontrada referenciando tabelas inexistentes (rg limpo)

---
## [W2] FROM J → H | ACK | CLOSED
Re: Outdated-Memory (telegram_otp, license_keys, has_role, 33 tabelas)
ACK — todos os 3 drifts críticos de schema incorporados ao am-report.md como HIGH na tabela de drift e como recomendação SCHEMA-H3. 33 tabelas e estrutura RLS/triggers documentados.
