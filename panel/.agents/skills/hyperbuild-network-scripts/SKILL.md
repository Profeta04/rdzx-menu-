---
name: hyperbuild-network-scripts
description: Production-grade patterns for building the scripts of the Hyper RB extension Scripts tab (Bloco B). Triggers on any work touching public/burp_src/scripts/, network-analysis tooling, replay/mutate, or AI-assisted request understanding.
---

# HyperBuild Network Scripts (Hyper RB — Bloco B)

Scripts auto-contidos, **disparados manualmente** pelo usuário na aba "Scripts" do sidepanel da Hyper RB. Operam sobre o buffer de requests capturadas por `burp_background.js`.

> **Nota de versão v4.0.7:** O diretório `public/burp_src/scripts/` contém 25 scripts (além dos 12 canônicos originais: chat-replay, smart-replay-fuzz, curl-exporter, har-exporter, openapi-exporter, ai-prompt-lens, dedup-detector, response-schema, token-lifecycle, ws-correlator, e2e-decryptor, dedup-detector). Não renumere os IDs canônicos — eles viram chave de storage e prompt.

Sempre pareie com `hyperbuild-extension-architect` (convenções da extensão), `hyperbuild-burp-lovable-master` (qualquer fetch para Lovable) e `hyperbuild-edge-functions` (uso do `/ai`).

---

## 1. Fundação já entregue (NÃO reimplementar)

Carregados em `burp_sidepanel.html` **antes** de qualquer script:

| Módulo | Global | Use para |
|---|---|---|
| `scripts/_shared.js` | `window.HYPER_RB_SHARED` | `sanitize`, `sanitizeAll`, `sanitizeHeaders`, `truncBody`, `formatBytes`, `formatMs`, `downloadBlob`, `mountDrawer`, `escapeHtml`, `makeStorage`, `cryptoUuid`, `sha256Hex`, `parseSSE` |
| `scripts/_registry.js` | `window.HYPER_RB_REGISTRY` | `getScripts()`, `getScript(idOrSlug)`, `runScript(idOrSlug, opts)`, `getByTag(tag)` |
| `burp_ai_client.js` | `callAI(action, payload)` | IA via background → `/ai` |
| `burp_background.js` | `proxyFetch(url, opts)` | Replay (allowlisted, SSRF-safe) |

---

## 2. Contrato de dados: ctx.requests e o pipeline de sanitização

### 2.1 Pipeline completo (obrigatório entender)

```
state.network (background, até 10.000 entradas)
  → getPublicState() → stripBody() → slice(0, 500)   ← networkForUi
  → broadcast BURP_NETWORK_UPDATED
  → state.data.network (sidepanel)
  → asArray(state.data.network)                        ← normaliza Array ou Object-keyed
  → S.sanitizeAll(rawRequests)                         ← mapeia campos e redacta
  → ctx.requests                                       ← o que o script recebe
```

**Consequência crítica — bodies ausentes em `ctx.requests`:**  
`stripBody()` em `burp_background.js` (linha ~295) **remove** `requestBody` e `responseBody` antes de servir ao sidepanel:
```js
function stripBody(entry) {
  const { requestBody, responseBody, ...meta } = entry;
  return meta;
}
```
Portanto `ctx.requests[*].reqBody` e `ctx.requests[*].resBody` serão **sempre `null`** via esse caminho.

Para obter o body real, use `ctx.getRawRequest(id)` (bridge adicionado em v4.0.1):
```js
const raw = await ctx.getRawRequest(r.id);
if (raw?.ok) {
  const body = raw.requestBody || raw.responseBody || "";
  // usar body aqui
}
```

### 2.2 Tipo canônico de ctx.requests (após sanitizeAll)

```ts
type SanitizedRequest = {
  id: string; ts: number;
  method: string; url: string;
  host: string; pathname: string; searchParams: Record<string,string>;
  status?: number; durationMs?: number;
  reqHeaders: Record<string,string>;  // já redacted (authorization, cookie → "<redacted>")
  resHeaders: Record<string,string>;
  reqBody: null;   // SEMPRE null via ctx.requests — use getRawRequest para corpo real
  resBody: null;   // idem
  isSSE: boolean; initiator?: string;
  kind?: string;   // "fetch"|"xhr"|"ws"|"sse"
};

type ScriptCtx = {
  requests: SanitizedRequest[];   // ≤ 500 entradas (slice UI), sem bodies
  licenseKey: string;
  callAI: (action: string, payload: unknown) => Promise<{ok:boolean; data?:any; error?:string; error_code?:string}>;
  proxyFetch: (url: string, opts: RequestInit & {signal?: AbortSignal}) => Promise<{ok:boolean; status:number; headers:Record<string,string>; body:string; durationMs:number; error?:string; aborted?:boolean}>;
  getRawRequest: (id: string) => Promise<{ok:boolean; requestBody?:string; responseBody?:string; error?:string}>;
  storage: { get(k:string): Promise<any>; set(k:string, v:any): Promise<void> };
  log: (level:"info"|"warn"|"error", msg:string, meta?:unknown) => void;
};

type ScriptResult = {
  ok: boolean; error?: string;
  summary?: string;
  render?: (mountEl: HTMLElement) => void;   // DOM só aqui
  artifact?: { filename: string; mime: string; content: string|Blob };
};
```

### 2.3 Normalização obrigatória no consumidor

**A registry já guarda internamente** (`makeCtx`: `Array.isArray(requests) ? requests : []`). Ainda assim, scripts devem ser defensivos para evitar o crash histórico `"((intermediate value) || []).filter is not a function"` — causado quando `ctx.requests` chegava como objeto-keyed antes do fix `asArray()`:

```js
async run(ctx) {
  // Padrão defensivo obrigatório — cobre edge cases de SW acordando a frio
  const reqs = Array.isArray(ctx.requests) ? ctx.requests : [];
  if (!reqs.length) return { ok: false, error: "Capture pelo menos 1 request antes." };
  // ... resto da lógica com `reqs`
}
```

---

## 3. Por que a aba Network pode aparecer vazia

`DENOISE_PATTERNS` em `burp_background.js` (linhas 24–31) filtra requests **antes** de entrar em `state.network`:

```js
const DENOISE_PATTERNS = [
  /\/auth\/v1\/token\?grant_type=refresh_token/i,
  /\/realtime\/v1\/websocket/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /sentry\.io/i,
  /\.posthog\.com/i,
];
```

Se a sessão capturar **apenas** requests que casam esses padrões, `network` ficará vazio. Orientar o usuário a navegar/interagir com o projeto para gerar requests de `/chat`, `/ai`, ou chamadas Supabase.

Também: `getPublicState()` serve apenas as **500 entradas mais recentes**. Em sessões longas com muitas requests, as antigas somem da UI (mas persistem em `state.network` até 10.000).

---

## 4. Por que durationMs = 0 e resBody vazio

- `durationMs` vem de `Date.now() - startedAt` no background. Se o SW acordou a frio após captura, `startedAt` pode ser 0, resultando em `durationMs = 0`.
- `resBody` é removido por `stripBody` (ver §2.1). Scripts que exibem "0B" sem usar `getRawRequest` estão lendo `null.length = TypeError` ou `"".length = 0`.
- Para calcular tamanho real, use `ctx.getRawRequest(r.id)` e meça `responseBody.length`.

---

## 5. Rate limits do content script (burp_content.js)

O content script aplica rate limiting por tipo de mensagem (janela deslizante de 5 s):

```js
const RATE_LIMITS = {
  HOOK_READY: 10,
  AUTH_SNAPSHOT: 20,
  REQUEST_COMPLETED: 600,
  REQUEST_FAILED: 200,
  WS_FRAME: 2000,
};
```

Se `REQUEST_COMPLETED` exceder 600/5s (pages com SSE muito rápido), requests adicionais são silenciosamente descartadas. Scripts que dependem de captura completa devem advertir o usuário se `ctx.requests.length` for exatamente 600 (possível truncamento).

---

## 6. AI actions whitelisted (estado atual do `/ai`)

`supabase/functions/ai/index.ts` → `ALLOWED_ACTIONS` + mapeamento de bridge no sidepanel:

| Action slug | Bridge type | Saída |
|---|---|---|
| `explain_lovable_request` | `BURP_AI_EXPLAIN` | Markdown (Gemini) |
| `convert_to_composer_recipe` | `BURP_AI_RECIPE` | JSON estruturado |
| `analyze_network_traffic` | `BURP_AI_ANALYZE` | Markdown (≤ 50 entries) |
| `suggest_mutations` | `BURP_AI_MUTATE` | Markdown com 3-6 mutações |
| `diagnose_failed_replay` | `BURP_AI_DIAGNOSE` | Markdown analisando falha |
| `classify_action_ptbr` | `BURP_AI_CLASSIFY` | JSON `{categoria, intencao, criticidade}` |

Qualquer script só pode invocar **uma destas**. Adicionar nova action requer (mesma release):
1. Entry em `ALLOWED_ACTIONS` + `SYSTEM_PROMPTS` no edge function
2. Entry em `callAIBridge` map em `burp_sidepanel.js`
3. Deploy + smoke test (`supabase--curl_edge_functions`)
4. Bump `BURP_VERSION` em `BurpLovable.tsx` + `manifest.json`

---

## 7. Lista canônica (NÃO renumerar — IDs viram chave de storage e prompt)

| # | slug | nome (PT-BR) | AI | rede | output |
|---|---|---|---|---|---|
| 1 | `cartographer` | Mapa de Endpoints | — | não | árvore + `openapi.json` |
| 2 | `payload-diff` | Rastreador de Payload | — | não | modal diff |
| 3 | `action-classifier` | Classificador PT-BR | `classify_action_ptbr` | não | badges inline |
| 4 | `dep-graph` | Grafo de Dependências | — | não | SVG force-directed |
| 5 | `cost-profiler` | Perfil Custo/Latência | — | não | barras + CSV |
| 6 | `replay-mutate` | Replay & Mutate | (opcional `suggest_mutations`) | sim (`proxyFetch`) | painel response |
| 7 | `sse-decoder` | Decodificador SSE | — | não | timeline de eventos |
| 8 | `drift-monitor` | Monitor de Drift | — | não | snapshot diff |
| 9 | `header-probe` | Sonda de Headers | — | sim (`proxyFetch`) | matriz |
| 10 | `error-miner` | Minerador de Erros | (opcional `diagnose_failed_replay`) | não | lista agrupada |
| 11 | `composer-explain` | `/explain <reqId>` | `explain_lovable_request` | não | resposta inline |
| 12 | `postman-export` | Postman Collection | — | não | download `.json` |

Scripts numerados ≥ 13 existem no diretório (chat-replay, smart-replay-fuzz, etc.) e seguem o mesmo contrato IIFE mas com IDs acima de 12 para não colidir.

---

## 8. Contrato do script (obrigatório)

```js
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · slug] HYPER_RB_SHARED ausente"); return; }

  const SCRIPT = {
    id: 1,                          // 1..N, fixo e único
    slug: "cartographer",           // kebab-case, fixo
    name: "Mapa de Endpoints",      // PT-BR, ≤ 32 chars
    description: "Agrupa requests por host+path+method e infere um OpenAPI 3.1.",
    icon: "🗺️",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,
    timeoutMs: 30_000,              // opcional; padrão 30s

    async run(ctx) {
      // OBRIGATÓRIO: normalização defensiva
      const reqs = Array.isArray(ctx.requests) ? ctx.requests : [];
      if (!reqs.length) return { ok: false, error: "Capture pelo menos 1 request antes." };

      // lógica pura — NUNCA toca DOM aqui
      const data = buildOpenApi(reqs);

      return {
        ok: true,
        summary: `${data.paths.length} endpoints em ${data.hosts.length} hosts`,
        render(mountEl) {
          // DOM SÓ AQUI
          mountEl.innerHTML = renderTree(data);
          mountEl.querySelector(".dl-openapi")?.addEventListener("click", () =>
            S.downloadBlob("hyper-rb-openapi.json", "application/json", JSON.stringify(data, null, 2))
          );
        },
        artifact: { filename: "hyper-rb-openapi.json", mime: "application/json", content: JSON.stringify(data) },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
```

---

## 9. Padrões obrigatórios

### 9.1 Separação pura / DOM
- `run()` faz **lógica pura** + retorna dados. **Nunca** toca DOM.
- DOM **só** em `render(mountEl)`. Use `S.escapeHtml()` para todo valor dinâmico.
- Eventos: `mountEl.addEventListener` (escopo do drawer). Sem listeners no `document`.

### 9.2 IA
- Sempre `await ctx.callAI(action, payload)`. Trate `error_code` `RATE_LIMITED`, `AUTH_FAILED`, `INVALID_PAYLOAD`.
- **Batchar**: classificador (#3) → fatias de 25 requests/chamada, concorrência ≤ 3.
- **Cachear** por hash estável: `S.sha256Hex(method + url + bodyHash)` em `ctx.storage`.
- **Timeout** defensivo: `Promise.race([call, sleep(20_000).then(() => ({ok:false, error:"timeout"}))])`.

### 9.3 Rede / replay
- Só via `ctx.proxyFetch`. Background valida allowlist (`lovable.dev|app`, `supabase.co`) + SSRF.
- **Hard cap**: ≤ 10 replays por clique. Botão "Executar" desabilita durante a corrida.
- **Sequencial** (não paralelo) com `await sleep(150)` entre chamadas.
- Nunca setar `Authorization`, `Cookie`, `Host`, `Content-Length` no client — use `S.REPLAY_BLOCKED_HEADERS` ou liste explicitamente.
- `proxyFetch` suporta `AbortSignal` — passe `signal` em operações longas para respeitar cancelamento do usuário.

### 9.4 Storage
- Namespace por slug: garantido por `ctx.storage` (via `S.makeStorage(slug)`).
- **Cap por slug**: 10 snapshots OU 2 MB. Comprima JSON antes (sem indent).
- Para drift (#8): snapshots circulares (drop oldest, max 10).
- Para cache (#3, #11): `{ [hash]: {value, ts} }` LRU com TTL 24h, max 50 entradas.

### 9.5 UX
- Card no grid: `icon` + `name` + `description` curta + botão "Executar" + timestamp do último run.
- Output via `S.mountDrawer(name)` → retorna `mountEl`.
- Loading state: `mountEl.innerHTML = '<div class="hyper-rb-loading">…</div>'`.
- Erros: `mountEl.innerHTML = '<div class="hyper-rb-error">…</div>'`. Nunca `alert()`.
- Respeitar `ql_rgb_enabled`.

### 9.6 Performance
- Loops `for` simples em datasets > 5k; nada de `reduce` aninhado.
- Grafo (#4): `requestIdleCallback` para layout; cap 200 nós.
- Charts (#5): SVG inline — sem lib externa.

---

## 10. Especificação técnica de cada script

### #1 `cartographer` — Mapa de Endpoints
- **Agrupa por** `${host}|${method}|${normalizePath(pathname)}` onde `normalizePath` substitui segmentos `/^[0-9a-f-]{8,}$/i` ou `/^\d+$/` por `{id}`.
- Para cada grupo: count, statuses (set), `avgMs`, `p95Ms`, `contentType` (do primeiro req), `sampleReqId`.
- **Infere OpenAPI 3.1**: usa `ctx.getRawRequest(sampleReqId)` para corpo de exemplo (≤ 2KB). `requestBody` quando body presente.
- Render: árvore colapsável `host > path > method`, click expande detalhes. Botão "Baixar OpenAPI".
- **Edge cases**: requests sem `host` (ignorar); `pathname === "/"` (manter como `/`).

### #2 `payload-diff` — Rastreador de Mudanças de Payload
- Usa `ctx.getRawRequest(id)` para comparar bodies reais (não os nulls do ctx.requests).
- Agrupa por `${method} ${host}${normalizePath}`. Para cada grupo ≥ 2 reqs: compara payloads consecutivos.
- **Diff** (sem lib): parse JSON; walk recursivo; `{path, op: "add"|"remove"|"change", from, to}`. Bodies não-JSON: diff de linhas (LCS, cap 200 linhas).
- Render: badge "N mudanças". Modal diff colorido (`+` verde, `-` vermelho, `~` âmbar).

### #3 `action-classifier` — Classificador PT-BR
- Filtra por `host.endsWith("lovable.dev") || host.endsWith("lovable.app") || host.endsWith("supabase.co")`.
- **Batching**: fatias de 25 → `callAI("classify_action_ptbr", { items: [{id, method, url, bodyExcerpt}] })`.
- Concorrência ≤ 3. Cache LRU por `S.sha256Hex(method+url+bodyExcerpt)`.
- Render: tabela `[badge categoria] [método] [path] [intenção]`. Filtro por criticidade. Exportar CSV.

### #4 `dep-graph` — Grafo de Dependências
- Janela deslizante de 5s: requests dentro da janela do anterior viram arestas `prev → curr`.
- Cap: top 200 nós (por degree). Layout force-directed (Fruchterman-Reingold, 100 iter, `requestIdleCallback`).
- **Edge case**: < 5 requests → "dados insuficientes".

### #5 `cost-profiler` — Perfil Custo/Latência
- Para calcular `totalBytes`: use `ctx.getRawRequest(r.id)` — `(requestBody||"").length + (responseBody||"").length`. `durationMs` de `ctx.requests` é suficiente (timings não são strippados).
- `estTokens = Math.ceil(totalChars/4)`.
- Render: 3 charts SVG inline (top 10 por bytes, ms, tokens). Tabela completa. Botão "Baixar CSV".

### #6 `replay-mutate` — Replay & Mutate
- UI: select request → formulário pré-preenchido. Usa `ctx.getRawRequest(r.id)` para preencher body/headers reais.
- Cap a **10 variantes** por execução. Sequencial, 150ms entre.
- **Opcional AI**: botão "Sugerir mutações" → `callAI("suggest_mutations", { request })`.
- **Segurança**: UI bloqueia `authorization`, `cookie`, `host`, `content-length` — nunca editáveis.

### #7 `sse-decoder` — Decodificador SSE
- Filtra `requests.filter(r => r.isSSE || (r.resHeaders["content-type"]||"").includes("text/event-stream"))`.
- Usa `S.parseSSE(raw)` (disponível desde `_shared.js` wave 3.2) em vez de parser custom.
- Render: timeline vertical, badge tipo + JSON expansível. Filtro por tipo. Export `.ndjson`.

### #8 `drift-monitor` — Monitor de Drift
- Snapshot atual = output do `#1 cartographer` (re-executa internamente).
- **added/removed/changed** comparando com `ctx.storage.get("last_snapshot")`.
- Cap 10 snapshots circulares. Botão "Salvar snapshot".

### #9 `header-probe` — Sonda de Headers
- Usa `ctx.getRawRequest(r.id)` para preencher headers originais.
- 6 variantes canônicas (UA Chrome/Safari/Firefox, sem UA, sem Referer, com X-Real-IP). Cap 10, 150ms entre.
- Render: matriz `variante × {status, ms, hashDelta}`.

### #10 `error-miner` — Minerador de Erros
- Filtra `status >= 400`. Agrupa por `${status}|${host}|${normalizePath}`.
- Botão "Diagnosticar" → `callAI("diagnose_failed_replay", { request, response })` via `ctx.getRawRequest`.

### #11 `composer-explain` — `/explain <reqId>`
- Body real via `ctx.getRawRequest(reqId)`. Usa `S.sha256Hex` para cache key.
- `callAI("explain_lovable_request")` → markdown.
- Botão "Replicar" → `callAI("convert_to_composer_recipe")` → `chrome.runtime.sendMessage({action:"applyComposerRecipe"})`.

### #12 `postman-export` — Postman Collection 2.1.0
- Usa `ctx.getRawRequest(r.id)` em loop (sequencial para não stressar SW) para body.
- Agrupar em folders por `host`. Schema `v2.1.0`. `S.downloadBlob`.
- **Edge case**: bodies binários → omitir.

---

## 11. Troubleshooting recente

### Crash: `"((intermediate value) || []).filter is not a function"`
**Causa**: script usava `ctx.requests.filter()` sem guard, e `ctx.requests` chegou como objeto keyed (antes do fix `asArray()` no sidepanel).  
**Fix**: sempre `const reqs = Array.isArray(ctx.requests) ? ctx.requests : [];` no topo do `run()`. A registry já guarda internamente mas o pattern defensivo protege contra edge cases.

### Aba Network vazia após captura
**Causas possíveis** (verificar em ordem):
1. Só requests denoised foram capturadas (refresh_token, analytics, sentry, posthog — filtradas por `DENOISE_PATTERNS` no background).
2. `burp_pageHook.js` não injetado — verificar `window.__BURP_LOVABLE_PAGE__` no console da página; se falso, a extensão não injetou.
3. SW acordou frio e perdeu `state.network` antes de persistir. Verifique `chrome.storage.local.get(["burp_network"])`.
4. Rate limit atingido: > 600 `REQUEST_COMPLETED` / 5s (sessão de SSE muito rápida).

### Captura com 0ms / 0B em todos os campos
**Causa**: `stripBody()` remove `requestBody`/`responseBody` antes de servir ao sidepanel. Scripts que tentam exibir tamanho via `(r.reqBody||"").length` sempre veem 0.  
**Fix**: use `ctx.getRawRequest(r.id)` para cada entry onde body/size importam. Cache o resultado se for chamado em loop.

---

## 12. Checklist de entrega por script

- [ ] Arquivo em `public/burp_src/scripts/<slug>.js`, contrato respeitado, IIFE.
- [ ] `id`, `slug`, `name`, `description`, `icon`, `needsAI`, `needsNetwork`, `minRequests` definidos.
- [ ] `run()` começa com `const reqs = Array.isArray(ctx.requests) ? ctx.requests : []`.
- [ ] `run()` puro (sem DOM), retorna `{ ok, summary, render?, artifact? }`.
- [ ] Body real obtido via `ctx.getRawRequest(id)` onde necessário (não via `ctx.requests[*].reqBody`).
- [ ] Usa `window.HYPER_RB_SHARED` para tudo (escape, download, drawer, sha256Hex, parseSSE).
- [ ] `render()` faz escape com `S.escapeHtml`; eventos no `mountEl`.
- [ ] IA (se usar): action está em tabela §6; trata `RATE_LIMITED`/`AUTH_FAILED`/timeout; cacheia.
- [ ] Rede (se usar): `ctx.proxyFetch`, cap 10, sequencial, sem headers sensíveis.
- [ ] Storage: namespaced via `ctx.storage`; cap respeitado (10 entradas ou 2MB).
- [ ] Adicionado ao array `BURP_FILES` em `src/components/burp/BurpLovable.tsx`.
- [ ] Carregado em `public/burp_src/burp_sidepanel.html` (ordem: shared → registry → scripts/*).
- [ ] `BURP_VERSION` em `BurpLovable.tsx` e `version` em `manifest.json` bumpados.
- [ ] Smoke test: capturar 5+ requests reais, clicar Executar, validar output.

---

## 13. Anti-patterns (rejeição imediata)

- Dois scripts no mesmo arquivo.
- Re-implementar `sanitize`, `escapeHtml`, `downloadBlob`, `mountDrawer`, `parseSSE`.
- `fetch()` direto para qualquer host — sempre via `proxyFetch` ou `callAI`.
- Usar `ctx.requests[*].reqBody` para exibir ou calcular tamanho de body — sempre `null` (use `getRawRequest`).
- Editar `Authorization` no client em `replay-mutate`.
- Auto-rodar no load do sidepanel (todos são manual-trigger).
- Adicionar action de IA sem entry no `callAIBridge` map de `burp_sidepanel.js`.
- `innerHTML` com valor dinâmico sem `escapeHtml`.
- Storage sem cap — vaza quota 5MB do `chrome.storage.local`.
- Loops `O(n²)` em > 1000 requests — use Map/Set.
- `alert()`, `confirm()`, `prompt()` — usar drawer/inline.
- Importar lib externa — vanilla JS only.
