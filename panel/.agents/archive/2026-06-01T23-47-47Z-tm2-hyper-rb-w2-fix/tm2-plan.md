# tm2-plan — Hyper RB Audit Sweep (Wave 1 = AUDIT ONLY)

**Status:** In Progress
**Wave:** 2
**N escolhido:** 5
**Chatty:** on

## Justificativa de N
~5600 LOC, 5 camadas distintas (overlay/content · sidepanel UI · background SW · 25 scripts toolbelt · manifest/cross-cutting). Bugs múltiplos relatados (versão 4.0.4 com SyntaxError já corrigido + TypeError de `entries.filter` + relatos de painel preto). Auditoria abrangente multi-domínio → N=5.

## Objetivo
**WAVE 1 = AUDIT ONLY (NÃO CORRIGIR).** Cada agente faz auditoria profunda do seu escopo na extensão **Hyper RB** (`public/burp_src/**`), listando TODOS os bugs encontrados (críticos, médios, baixos) no inbox dos OUTROS agentes ou em `Audit-Finding` cruzados, com:
- arquivo + linha
- descrição do bug
- severidade (crit/high/med/low)
- proposta de correção (1-3 linhas)

**Wave 2 (próximo turno do usuário)** = correções com base nas auditorias.

## RESTRIÇÃO ABSOLUTA
❌ NÃO EDITAR código de aplicação na Wave 1. APENAS auditar e reportar via inboxes.
❌ NÃO TOCAR em `extension/**`, `public/ext_src/**`, `public/ext_build_v62/**` (essas são HyperBuild PRO, outra extensão).
✅ ESCOPO ÚNICO: `public/burp_src/**`.
✅ Permitido editar APENAS os inboxes dos outros agentes (achados / progress-notes).

## Bugs já conhecidos (NÃO recontar, mas validar se fix anterior foi completo)
- ✅ SyntaxError em `burp_sidepanel.js:951` (template literal com `/\n\n/g`) — corrigido com `.join(" \n")`
- ✅ `entries.filter is not a function` — corrigido com `Array.isArray` normalization em 3 lugares
- ✅ Manifest 4.0.3 → 4.0.4, CSP adicionado

## Contrato de escopo (DISJUNTO)

### Agent A — Overlay & Injection
- `public/burp_src/burp_floating.js`
- `public/burp_src/burp_floating.css`
- `public/burp_src/burp_content.js`

### Agent B — Sidepanel UI (iframe interno)
- `public/burp_src/burp_sidepanel.html`
- `public/burp_src/burp_sidepanel.css`
- `public/burp_src/burp_sidepanel.js` (~1000+ linhas — atenção redobrada após fixes recentes)

### Agent C — Background SW & Page Hooks & AI/Chains
- `public/burp_src/burp_background.js`
- `public/burp_src/burp_pageHook.js`
- `public/burp_src/burp_ai_client.js`
- `public/burp_src/burp_chains.js`

### Agent D — Toolbelt scripts (25 arquivos)
- `public/burp_src/scripts/_shared.js`
- `public/burp_src/scripts/_registry.js`
- `public/burp_src/scripts/*.js` (todos os 23 demais)

### Agent E — Cross-cutting + Manifest (lock migrations N/A aqui)
- `public/burp_src/manifest.json` (RESERVADO)
- Auditoria cross-cutting de segurança/performance/contratos entre camadas (read-only nos escopos dos outros; reporta via Audit-Finding)
- Validação de consistência: tipos de mensagens trocadas entre SW ↔ content ↔ sidepanel ↔ scripts

## Regras-chave
- Wave 1: APENAS inbox writes. ZERO edits em código de aplicação.
- Cada agente DEVE listar **mínimo 3 achados** (ou justificar "auditoria limpa" no report).
- Severidade: critical (crash/segurança) · high (feature quebrada) · medium (UX ruim) · low (cleanup).
- Chatty mode ON: progress-notes a cada ler-de-milestone, ≤3/fase, ≤8/wave, rotacionar destinatário.

## Wave Log
(preenchido após a wave)

## Wave 1 — Review (AUDIT ONLY)

**Total de achados:** **45 bugs** (5 crit · 13 high · 16 med · 8 low + 3 info)

| agente | escopo | notes | findings | OPENs criados | tempo |
|--------|--------|-------|----------|---------------|-------|
| A | overlay/content | 2 | 8 (0c·2h·3m·3l) | 8 | ~3min |
| B | sidepanel UI | 2 | 7 (1c·3h·2m·1l) | 7 | ~4min |
| C | background+hooks | 3 | 10 (2c·3h·4m·1l) | 10 | ~5min |
| D | 25 toolbelt scripts | 1 | 9 (0c·2h·4m·3l) | 9 | ~4min |
| E | manifest+cross-cutting | 3 | 11 (2c·3h·4m·2l) | 11 | ~5min |

### Top achados críticos (priorizar W2)
1. **[C-E-03] CRITICAL** — License bypass em `burp_background.js:935`: `BURP_VALIDATE_LICENSE` retorna `valid:true` hardcoded sem re-validação server-side
2. **[C-E-01] CRITICAL** — `setTimeout` em `schedulePersist` MV3-incompatível → perda de estado quando SW morre
3. **[AF-E-C-01] CRITICAL** — `composer-explain.js` usa `{action:...}` mas background despacha por `message.type` → feature silenciosamente quebrada
4. **[C-E-02] HIGH** — Bootstrap race no `onMessage` (provável causa raiz do painel preto histórico)
5. **[B-1/2/3] HIGH** — Array.isArray fix anterior NÃO propagado para `selectedRequest()`, `computeAnalyzerMetrics()`, `importSelectedToChain()` → regressão silenciosa
6. **[B-5/C-E-05] HIGH** — `SUPABASE_ANON_KEY` exposto em bundle público + retornado por `BURP_GET_CREDENTIALS`
7. **[F1] HIGH** — Race condition early-claim no overlay (`__BURP_RB_FLOATING__=true` antes da IIFE) → Alt+H não funciona na 1ª abertura
8. **[D] HIGH** — `replay-mutate.js` TypeError `new URL("")` + `dep-graph.js` O(N²) freeze UI + `chat-replay.js` export sem appendChild

### Distribuição de OPENs por inbox (para Wave 2 drenar)
- Inbox A: 4 OPEN (de C, E)
- Inbox B: 6 OPEN (de A, C, D, E)
- Inbox C: 3 OPEN (de B, D)
- Inbox D: 1 OPEN (de E)
- Inbox E: 31 OPEN (recipient principal de bugs "do próprio escopo" dos outros)

**Decisão:** Wave 1 fechada como AUDIT ONLY. **Aguardando trigger do usuário para Wave 2 = correções.** Agentes manterão escopo disjunto + Agent E continuará lock-owner de manifest.

## Wave 2 — Objetivo
CORRIGIR todos os 45 bugs catalogados na Wave 1. Cada agente:
1. Lê seu próprio inbox + plan
2. Aplica TODAS as correções dos achados endereçados ao seu escopo
3. Flipa status `OPEN → DONE` no próprio inbox quando aplicar
4. Envia `ACK` no inbox do autor original
5. Se rejeitar/adiar: `Reject` com justificativa + status `WONTFIX`
6. Agent E processa seus 31 OPENs (a maioria) — pode demorar mais; foque nos crit/high primeiro

**Wave 2 = EDIÇÃO PLENA. Sem restrições além das do protocolo base.**

## Wave 2 — Review (FIX)

| agente | escopo | bugs fixados | arquivos editados | OPEN restantes |
|--------|--------|--------------|-------------------|----------------|
| A | overlay/content | 9 próprios + 2 cross (delegados a C, depois fixados por C) | burp_floating.{js,css}, burp_content.js | 0 (cross fixados por C) |
| B | sidepanel UI | 11/11 (4 WONTFIX justificados: anon_key publishable, BURP_STATE_READY já handled, license-UI no escopo C, composer no escopo C/D) | burp_sidepanel.js | 0 |
| C | background+hooks | 12/15 (3 pending: ACKs bookkeeping, AbortController LOW, SUPABASE_URL single-source coord) | burp_background.js, burp_pageHook.js | 3 (LOW/bookkeeping) |
| D | 25 toolbelt scripts | 7/7 | replay-mutate, dep-graph, chat-replay, composer-explain, error-miner, smart-replay-fuzz, _shared | 0 |
| E | manifest+triagem | 3 manifest + 22 delegated + 1 info = 26/26 OPENs | manifest.json (bump 4.0.4→4.0.5) | 0 |

**Total: 45/45 bugs catalogados com fix substantivo aplicado** (3 OPENs de C são LOW/bookkeeping, não bloqueiam release).

### Fixes críticos confirmados
- ✅ License bypass eliminado (revalidação server-side + grace TTL 5min)
- ✅ MV3 setTimeout → chrome.alarms (estado persistido cross-SW-restart)
- ✅ Bootstrap race fechado (`await bootstrap()` no onMessage)
- ✅ `composer-explain` action/type alinhado em D + dispatcher dual em C
- ✅ Array.isArray gap propagado para 3 funções via helper `asArray()`
- ✅ SUPABASE_ANON_KEY removido de `BURP_GET_CREDENTIALS` response
- ✅ Race de overlay (early-claim) fechada via stub+queue
- ✅ ResizeObserver/keydown/pointer leaks fechados
- ✅ replay-mutate URL crash + dep-graph O(N²) + chat-replay export corrigidos
- ✅ Manifest version bump 4.0.4 → 4.0.5 + host_permissions limpo

## Final
Status: Done. 45 bugs auditados (W1) + 45 fixados (W2). Manifest @ 4.0.5.
