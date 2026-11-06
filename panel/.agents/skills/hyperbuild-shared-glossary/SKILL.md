---
name: hyperbuild-shared-glossary
description: Glossário canônico de terminologia, identidades de produto e convenções cross-cutting para as 8 skills hyperbuild-*. Consulte ANTES de escrever ou revisar qualquer skill hyperbuild-*. Resolve ambiguidades de naming, define acrônimos e mapeia sinônimos usados historicamente.
---

# HyperBuild Shared Glossary

> **Escopo:** Este documento é a fonte de verdade para terminologia compartilhada entre todas as skills `hyperbuild-*`. Qualquer skill que usar um termo divergente deve ser atualizada para seguir este glossário.

## 1. Identidades de produto

| Nome canônico | Contexto de uso | Sinônimos históricos (NÃO usar) |
|---|---|---|
| **HyperBuild** | Nome do produto extensão Chrome end-to-end | "Hyper", "HB" (só em nomes de variável JS) |
| **Hyper RB** | Sub-produto: aba de análise de rede / Burp-like dentro do HyperBuild | "Burp", "burp suite interceptor" (confunde com OWASP Burp Suite) |
| **Hyper RB — Bloco B** | Os 12 scripts da aba Scripts do sidepanel Hyper RB | — |
| **extension** | O bundle MV3 em `extension/` | "client", "frontend" (ambíguo com UI web) |
| **edge function** | Função Supabase Edge em `supabase/functions/<fn>/` | "backend function", "serverless function", "cloud function" |
| **_shared** | O módulo `supabase/functions/_shared/` | "helpers", "utils" |

## 2. Terminologia de licença

| Termo canônico (EN, código) | Termo canônico (PT, UI) | NÃO usar |
|---|---|---|
| `license_key` | chave de licença | "activation key", "serial", "token" |
| `device_id` | ID de dispositivo | "fingerprint_id", "hwid" |
| `session_id` | ID de sessão | "auth_token", "user_token" |
| `license.status === "active"` | licença ativa | "valid license", "licensed" |
| device conflict | conflito de dispositivo | "device mismatch", "duplicate login" |

## 3. Terminologia de segurança

| Termo | Definição canônica |
|---|---|
| `validateExtensionRequest` | Verificação HMAC + anti-replay executada em **toda** edge function antes do parse do body. Nunca pulada. |
| `isRateLimitedByIp` | Rate limit por IP, primeira barreira (mais barata). |
| `isRateLimitedByLicense` | Rate limit por licença, segunda barreira (para endpoints custosos). |
| SSRF guard | Verificação via `isPrivateHost()` que rejeita IPs privados/loopback/metadata antes de qualquer `fetch()` com URL controlada pelo cliente. |
| `mapLovableError` | Função que converte erros upstream da Lovable API para `{ error_code, error_display, user_action, retryable }`. Nunca retornar o erro raw. |
| `logFraud` | Inserção fire-and-forget em `fraud_alerts`. Não bloqueia o request. Usar para eventos suspeitos. |

## 4. Terminologia de proxy Lovable

| Termo | Definição |
|---|---|
| rotated headers | Headers anti-fingerprint gerados por `buildRotatedHeaders(token)`: UA pool, random XFF, X-Request-ID. |
| `fetchWithRetry` | Wrapper de `fetch` com retry exponencial em 5xx/network errors, **sem retry em 4xx**. |
| `SERVER_ACTION_PROMPTS` | Mapa server-side `{ action_name: canonical_prompt }`. Cliente envia `action: "key"`, servidor substitui. Nunca no bundle do cliente. |
| token sync | Fluxo `pageHook.js → background → sync function` para capturar `lovable_token` do contexto da página. Único ponto de entrada do token no sistema. |

## 5. Terminologia de extensão

| Termo | Definição |
|---|---|
| floating mode | UI sobreposta à página `lovable.dev`, gerenciada por `content.js` + `floating.css`. |
| sidepanel mode | Chrome native side panel, gerenciado por `sidepanel.js` + `sidepanel.css`. |
| `proxyFetch` | Mensagem `chrome.runtime.sendMessage({action:"proxyFetch",...})` para rotear fetch via `background.js`. Todo call cross-origin da extensão usa isso. |
| `ql_` prefix | Prefixo obrigatório para **todas** as chaves em `chrome.storage.local`. Inclui `ql_lovable_token`, `ql_lovable_projectId`. Sem exceções. |
| send method | Modo de envio selecionado no menu (v1/v2/…/master/auto). Persiste em `ql_send_method`. |

> **Nota sobre `lovable_token`**: Historicamente armazenado sem prefixo `ql_` em algumas versões. O nome canônico é `ql_lovable_token`. Skills e código legado que ainda usam `lovable_token` (sem prefixo) estão na lista de migration debt.

## 6. Terminologia de release

| Termo | Definição |
|---|---|
| source of truth | `extension/` — único diretório editado por humanos/agentes. |
| build folder | `public/ext_build_v62/` — output servido. Nunca editado diretamente. |
| version bump | Atualização síncrona de `extension/manifest.json` e `public/ext_build_v62/manifest.json`. |

## 7. Edge functions — catálogo canônico atual

> Fonte: `supabase/functions/` em v4.0.7. **28 funções** (exclui `_shared`). A skill `hyperbuild-edge-functions` menciona "22 functions" — esse número está desatualizado.

Funções adicionadas após a contagem original de 22:
`ai`, `dev-proxy-test`, `dz`, `get-license-user`, `get-notifications`, `get-user-role`, `get-versions`

A função `/ai` é usada por `hyperbuild-network-scripts` (scripts Hyper RB) como backend de IA. Qualquer skill que liste funções externas permitidas deve incluir `/ai`.

## 8. Gaps temáticos conhecidos (sem skill dedicada)

| Gap | Impacto | Ação sugerida |
|---|---|---|
| **Testing** | Só `hyperbuild-burp-lovable-master` tem seção de testes. As demais skills carecem de orientação sobre como testar edge functions, extensão, e scripts. | Adicionar seção "Testing" a cada skill ou criar `hyperbuild-testing-guide`. |
| **Observability** | Logging estruturado documentado apenas em `burp-lovable-master`. Sem guia para dashboards, alertas Telegram, ou métricas de `/heartbeat`. | Adicionar seção a `hyperbuild-cost-optimizer` ou nova skill. |
| **Error reporting ao usuário** | `report-error` edge function existe mas nenhuma skill documenta o contrato de erro nem o fluxo de feedback ao usuário. | Adicionar seção em `hyperbuild-edge-functions` ou `hyperbuild-licensing-flow`. |
| **Telemetria de uso** | `pings_today`/`pings_total` mencionados em `hyperbuild-licensing-flow` mas sem documentação de como analisar ou usar os dados. | Adicionar parágrafo em `hyperbuild-cost-optimizer`. |

## 9. Anti-padrões cross-cutting

Estes anti-padrões aparecem em múltiplas skills e são listados aqui para evitar repetição:

- **`fetch()` direto do cliente** para qualquer host externo — sempre via `proxyFetch` (background) ou edge function.
- **`token_lovable` aceito do body do cliente** — token vem de `licenses.lovable_token` (server-stored). Legacy `/cp` e `/uf` estão em migration debt.
- **Validação de licença apenas no cliente** — o servidor revalida em cada chamada sensível.
- **Retornar erro raw de upstream** — sempre mapear via `mapLovableError` ou `genericError`.
- **Editar `public/ext_build_v62/` diretamente** — editar em `extension/`, synclar via release-packager.
