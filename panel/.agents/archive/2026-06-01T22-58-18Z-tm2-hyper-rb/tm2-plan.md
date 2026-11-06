# tm2-plan — Hyper RB Bugfix Sweep

**Status:** In Progress
**Wave:** 0
**N escolhido:** 5
**Chatty:** on

## Justificativa de N
~5600 LOC, 5 camadas distintas (overlay/content · sidepanel UI · background SW · 25 scripts toolbelt · manifest/cross-cutting), bug visual reportado (painel preto, sem render) + version bump (4.0.3). Refactor multi-domínio → N=5.

## Objetivo
Achar e CORRIGIR todos os bugs da extensão **Hyper RB** (`public/burp_src/**`). Sintoma reportado: painel flutuante abre mas o conteúdo do iframe fica TOTALMENTE PRETO (sem topbar, sem gradient, sem nada). Versão atual: 4.0.3 → bumpar para 4.0.4 após fixes.

## RESTRIÇÃO ABSOLUTA
❌ NÃO TOCAR em `extension/**` (essa é a HyperBuild PRO, outra extensão).
❌ NÃO TOCAR em `public/ext_src/**` nem `public/ext_build_v62/**` (também HyperBuild).
✅ ESCOPO ÚNICO: `public/burp_src/**`.

## Hipóteses iniciais de causa (investigar)
1. `burp_sidepanel.js` linha ~13: `SUPABASE_URL = "__SUPABASE_URL__"` (placeholder de build nunca substituído) — pode crashar antes de buildShell().
2. Algum dos 25 scripts em `scripts/*.js` lança erro síncrono no load → para o pipeline antes de `burp_sidepanel.js` rodar.
3. CSS de `body/#app` com `height:100vh` dentro de iframe pode colapsar a altura efetiva.
4. CSP da página hospedeira (lovable.dev) bloqueando iframe de `chrome-extension://`.
5. `web_accessible_resources` não inclui todos scripts necessários (ex: `burp_sidepanel.css` está listado mas vale revalidar).

## Contrato de escopo (DISJUNTO)

### Agent A — Overlay & Injection (núcleo do bug visual)
- `public/burp_src/burp_floating.js`
- `public/burp_src/burp_floating.css`
- `public/burp_src/burp_content.js`

### Agent B — Sidepanel UI (iframe interno)
- `public/burp_src/burp_sidepanel.html`
- `public/burp_src/burp_sidepanel.css`
- `public/burp_src/burp_sidepanel.js`

### Agent C — Background SW & Page Hooks
- `public/burp_src/burp_background.js`
- `public/burp_src/burp_pageHook.js`
- `public/burp_src/burp_ai_client.js`
- `public/burp_src/burp_chains.js`

### Agent D — Toolbelt scripts (25 arquivos)
- `public/burp_src/scripts/_shared.js`
- `public/burp_src/scripts/_registry.js`
- `public/burp_src/scripts/*.js` (todos os 23 restantes)

### Agent E — Cross-cutting + Manifest + Versioning (lock equivalente a migrations)
- `public/burp_src/manifest.json` (RESERVADO — bump para 4.0.4, revisar permissions/CSP/web_accessible_resources)
- Auditoria cross-cutting de segurança/performance (read-only nos escopos dos outros; reporta via Edit-Request)
- Validação final: contagem de bugs corrigidos, smoke check dos endpoints

## Reservado ao Orchestrator
- Coordenação, archive, response final.
- Não há arquivos globais do projeto envolvidos (extensão isolada).

## Regras-chave
- Subagentes têm **write access** e DEVEM editar diretamente seu escopo.
- Cross-scope changes via `Edit-Request` no inbox do dono.
- Manifest changes SEMPRE Agent E (equivalente a Migration-Request).
- Hotfix (crash, segredo vazado) permitido fora do escopo com `Hotfix-Notice`.
- Chatty mode ON: progress-notes a cada edit/exec, ≤3/fase, ≤8/wave, rotacionar destinatário.

## Wave Log
(preenchido após cada wave)
