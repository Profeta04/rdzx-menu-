# Inbox G

## Inbox
(append-only — entradas mais novas embaixo)

## Report W1 — CONCLUÍDO

### 1. CATÁLOGO DE EDGES (escopo desta wave)

| Edge | Propósito | Método | verify_jwt | Secrets |
|------|-----------|--------|-----------|---------|
| /ai | Proxy Lovable AI Gateway (explain, convert, analyze, mutate, diagnose, classify) | POST | ✗ (IP rate-limit) | LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY |
| /burp | Replay HTTP raw para lovable/supabase (burp suite interno) | POST/GET | ✗ | SUPABASE_SERVICE_ROLE_KEY |
| /cp | Criar projeto Lovable via API upstream | POST | ✗ | LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY |
| /dz | Download ZIP do projeto Lovable | POST | ✗ | LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY |
| /gn | Listar notificações (public, cache 60s) | GET | ✗ | SUPABASE_SERVICE_ROLE_KEY |
| /gp | Listar pacotes/planos (public, cache 120s) | GET | ✗ | SUPABASE_SERVICE_ROLE_KEY |
| /gr (get-user-role) | Retornar roles do dono da licença | POST | ✗ | SUPABASE_SERVICE_ROLE_KEY |
| /gu (get-license-user) | Retornar user_id da licença | POST | ✗ | SUPABASE_SERVICE_ROLE_KEY |
| /gv (get-versions) | Versão da extensão (public, cache 120s) | GET | ✗ | SUPABASE_SERVICE_ROLE_KEY |
| /op | Otimizador de prompt (Groq/OpenAI fallback) | POST | ✗ | GROQ_API_KEY ou OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY |
| /pc | Proxy principal → api.lovable.dev/projects/{id}/chat (core bypass) | POST | ✗ | LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY, DEV_LICENSE_KEY |
| /pp (process-payment) | Registrar pagamento pendente em `payments` | POST | ✗ | SUPABASE_SERVICE_ROLE_KEY |
| /uf | Upload de arquivo para Lovable (generate-upload-url → PUT S3/GCS) | POST | ✗ | SUPABASE_SERVICE_ROLE_KEY |
| /vx | Validar licença + hardware-lock + sessão + heartbeat | POST | ✗ | SUPABASE_SERVICE_ROLE_KEY |
| /dev-proxy-test | Testar rotação de proxies via api.ipify.org | POST/GET | ✗ (x-dev-license=DEV_LICENSE_KEY) | DEV_LICENSE_KEY, SUPABASE_SERVICE_ROLE_KEY |

### 2. AI Gateway (/ai)
- **Modelo default:** `google/gemini-3-flash-preview`; aceita qualquer `google/*` do client.
- **Actions whitelist (6):** explain_lovable_request, convert_to_composer_recipe, analyze_network_traffic, suggest_mutations, diagnose_failed_replay, classify_action_ptbr.
- **Rate-limit:** 30 req/min por IP (tabela `security_logs`, event_type=ai_request).
- **Payload:** máx 32 KB; user content truncado a 16 KB; resposta truncada a 4 KB.
- **fast_mode:** NÃO existe em /ai. fast_mode está em /pc (v1: true, v3: true, v4: ausente).
- **Telemetria:** sampling 1:5 (20%) → tabela `ai_usage_logs`.

### 3. Proxy Rotation (/pc)
- Proxy ativo **somente** quando `license_key === DEV_LICENSE_KEY` (env secret). Usuários normais → fetch direto.
- `pickRandomProxy()` lê tabela `proxies` (campo `active=true`), sorteia 1 aleatório por attempt.
- `fetchViaProxy()` → TCP→CONNECT HTTP/1.1→TLS manual (Deno.startTls) → HTTP/1.1. Implementação nativa para contornar bug undici no Supabase Edge Runtime.
- Retry: até 3 attempts com backoff 500ms×3^attempt. Falha de proxy marca `last_status/last_egress_ip` via `markProxyCheck`.
- `/dev-proxy-test` testa N proxies em paralelo contra api.ipify.org; gating por `x-dev-license`.

### 4. Licença/Heartbeat Lifecycle (cross-ref F)
1. **Bind:** /vx recebe license_key+device_id sem heartbeat → persiste `device_id` em `licenses` (first activation).
2. **Takeover:** device diferente + sem heartbeat + cooldown 10min → atualiza device_id, revoga sessões antigas.
3. **Heartbeat:** /vx com `heartbeat=true` + `session_id` → debounce 90s; se >90s: RPC `increment_license_editing_time` + update `last_heartbeat`.
4. **Sessão:** criada no /vx; revogada por takeover ou cron `cleanup-stale-sessions-2min`.
5. **Expiração:** verificada no /vx em tempo real → auto-update status para "expired".
6. **Blacklist:** 2 keys hardcoded em /vx retornam mensagem de pirataria.

### 5. Findings de Auditoria (HIGH)
- **DRY violation em /dz:** BROWSER_PROFILES, fetchWithRetry, mapLovableError, humanJitter copiados inline em vez de importar `_shared/lovable.ts`. Risco de divergência de fingerprint UA.
- **/pp sem validateExtensionRequest:** process-payment não valida HMAC da extensão, sem rate-limit por IP. Só HARD-VALIDATION de licença (soft: device_id opcional).
- **/gn, /gp, /gv totalmente públicos:** sem qualquer autenticação — dados de notificações, pacotes e versão expostos a qualquer request.

### 6. Mensagens enviadas
- → J (Outdated-Memory): drift em backend-architecture, promptx-secrets, cost-optimizer, proxy-rotation.
- → C (Cross-Ref): /burp chama lovable.dev+lovable.app+supabase.co via ALLOWED_HOST_PATTERNS; não chama /pc nem /ai.

## Findings Log
(fire-and-forget — sem flip de status)

---
## Wave 2 — Status
- **Inbox drenada:** 0 OPENs encontrados.
- **Cross-refs:** Todos os findings de W1 (AI Gateway, Proxy Rotation, Lifecycle, Findings de Auditoria) foram entregues a J.
- **Status:** W2 CONCLUÍDO.

---
## [W2] FROM J → G | ACK | CLOSED
Re: Outdated-Memory (backend-architecture, promptx-secrets, proxy-rotation, cost-optimizer)
ACK — todos os 4 drifts incorporados ao am-report.md. Seções "Edges Proxy/AI/Licença" e "Drift vs Memória" refletem os findings. Nenhuma ação adicional necessária de G.
