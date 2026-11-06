# WebSocket Interceptor — Hyper RB

Objetivo: permitir **capturar**, **editar em trânsito** (breakpoint) e **enviar/forjar** frames WebSocket dentro de `lovable.dev` / `lovable.app`, mantendo a mesma arquitetura segura da extensão (top-frame only, rate-limited, MV3 SW + sidepanel).

Tudo será feito em `public/burp_src/**` (fonte de verdade da Hyper RB) e o `manifest.json` da Hyper RB sobe para `4.1.0`.

---

## Fase 1 — Captura real de WebSocket (fundação)

Hoje só temos captura passiva via fetch/XHR. Precisamos patchar o `WebSocket` no MAIN world.

**Arquivo:** `public/burp_src/burp_pageHook.js`
- Patch do construtor `WebSocket`:
  - Atribui `wsId = crypto.randomUUID()` por conexão.
  - Emite `WS_OPEN` (`{wsId, url, protocols, ts}`).
  - Encapsula `send()` original → emite `WS_FRAME` com `{wsId, direction:"send", data, ts, frameId}`.
  - Listener `message` → emite `WS_FRAME` `direction:"recv"`.
  - `close`/`error` → `WS_CLOSE`.
- Binário (`ArrayBuffer`/`Blob`): preview base64 (≤ 8KB) + flag `binary:true`.
- Detecção de `id/requestId/correlationId` reusando heurística de `scripts/ws-correlator.js` (extrai para `_shared.js`).

**Arquivo:** `public/burp_src/burp_content.js`
- Adiciona `WS_OPEN`/`WS_CLOSE` ao `RATE_LIMITS` (50/5s cada). `WS_FRAME` já existe (2000/5s).

**Arquivo:** `public/burp_src/burp_background.js`
- Novo buffer `state.wsConnections: Map<wsId, {url, openedAt, frames: number, closed?: ts}>` (cap 50 conexões, LRU).
- `state.wsFrames` (cap 5000) com `stripBody` análogo (preview ≤ 2KB para UI; raw fica no SW).
- Broadcast `BURP_WS_UPDATED` para sidepanel.
- Bridge `BURP_GET_WS_FRAME(frameId)` → retorna data completa (igual `getRawRequest`).

---

## Fase 2 — Editar / criar / breakpoint

**Canal de controle pageHook ↔ SW**

Adicionar mensagens postMessage no `burp_pageHook.js` (MAIN ↔ ISOLATED world) e relay no `burp_content.js`:

| Tipo | Direção | Função |
|---|---|---|
| `WS_INTERCEPT_RULES` | SW → page | Lista de regras `{wsId?, direction, urlRegex?, payloadRegex?, mode: "pause"\|"drop"\|"rewrite", rewriteTo?}` |
| `WS_FRAME_PAUSED` | page → SW | Frame casou regra `pause`; bloqueado aguardando decisão (com `pauseId`) |
| `WS_RESUME` | SW → page | `{pauseId, action:"send"\|"drop", data?}` libera/dropa/edita |
| `WS_INJECT_FRAME` | SW → page | `{wsId, direction:"send"\|"recv", data}` força envio (`originalSend`) ou simula `MessageEvent` recebido |

No pageHook:
- Mantém `Map<wsId, WebSocket>` e `Map<pauseId, {resolve}>`.
- `direction:"send"` interceptado: `await pauseIfNeeded(frame)` antes de chamar `originalSend`.
- `direction:"recv"` interceptado: usa `EventTarget` proxy — substitui o `MessageEvent` por um novo via `dispatchEvent(new MessageEvent('message', {data: edited}))` quando regra é `rewrite`.
- Injeção forjada SEND: `ws._origSend(data)`. Injeção forjada RECV: `dispatchEvent` no socket original (a app não distingue).

**Edge: nada novo.** Tudo vive no client (regras armazenadas em `chrome.storage.local` chave `burp_ws_rules`).

---

## Fase 3 — UI no sidepanel (nova aba "WebSocket")

**Arquivos:** `public/burp_src/burp_sidepanel.html` + `burp_sidepanel.js` + `burp_sidepanel.css`

- Nova aba "WebSocket" (ao lado de Network/Scripts).
- **Lista de conexões** (esquerda): `wsId` curto, URL, contador de frames, status.
- **Stream de frames** (centro): timeline com filtro por direção/regex, badges `SEND`/`RECV`/`PAUSED`.
- **Inspector** (direita): JSON viewer + botões:
  - **Replay**: reenvia frame original.
  - **Edit & Replay**: editor JSON → `WS_INJECT_FRAME`.
  - **Forge RECV**: simula resposta vinda do servidor (debug client).
- **Regras de intercept** (painel collapse):
  - Form simples: wsId (ou "qualquer"), direction, regex de payload, ação (`pause`/`drop`/`rewrite` + template).
  - Persistido em `burp_ws_rules` + sincronizado via `WS_INTERCEPT_RULES`.
- Quando um frame entra em `pause`: modal **"Frame pausado"** com editor e botões `Send original`, `Send edited`, `Drop`. Timeout 30s → libera original automaticamente para não travar a app.

---

## Detalhes técnicos / segurança

- **Top-frame only**: patch de `WebSocket` apenas se `window === window.top` (já é o padrão do pageHook).
- **Allowlist**: o patch é instalado em qualquer página onde o content script roda (`lovable.dev`/`lovable.app` pelo manifest). Não vaza para outros domínios.
- **Cap & GC**: 50 conexões / 5000 frames totais; LRU descarta conexões fechadas + frames mais antigos.
- **Binário**: editar binário fica fora desta fase (apenas captura preview); editor JSON valida `JSON.parse` antes de enviar.
- **Sem proxy de rede**: o `proxyFetch` do SW não substitui WS — toda manipulação acontece via patch no MAIN world; SW só orquestra regras e UI.
- **Anti-loop**: frames injetados ganham flag `__hb_synthetic` para não serem reemitidos pela própria captura.
- **Manifest bump**: `public/burp_src/manifest.json` `version` → `4.1.0`. Mensagem nova no `_registry`/sidepanel HTML carrega `burp_ws_console.js` (módulo da aba).

---

## Entregáveis por fase (commits separados — mais fácil de revisar)

```text
Fase 1  burp_pageHook.js, burp_content.js, burp_background.js, burp_sidepanel.js (apenas exibir lista WS)
Fase 2  burp_pageHook.js, burp_background.js (regras + bridge), _shared helpers
Fase 3  burp_sidepanel.html/.css/.js, novo burp_ws_console.js, manifest 4.1.0
```

Sem mudanças no admin web nem em edge functions.

---

## Riscos conhecidos

1. **Apps que congelam `WebSocket`** (`Object.freeze(window.WebSocket)`): nosso patch precisa rodar antes do bundle da app — `pageHook` já injeta em `document_start`, então OK no lovable.dev.
2. **Frames muito rápidos** (SSE-style WS): rate-limit do content script (2000/5s) pode descartar — vamos elevar o cap dentro da aba WS para 5000/5s, mas alertar o usuário quando truncar.
3. **Forge RECV** pode quebrar lógica da app se schema não bate — é ferramenta de pesquisa/debug, não para produção. UI mostra warning.

Quer que eu vá pela ordem Fase 1 → 2 → 3 (3 turnos), ou prefere tudo num PR só?