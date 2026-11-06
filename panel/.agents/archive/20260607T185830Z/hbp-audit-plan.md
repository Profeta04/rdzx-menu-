# HBP Audit Plan — RGB + Dark/Light Mode (HyperBuild PRO)

## Objetivo
Diagnosticar por que:
1. **RGB visual não funciona** na extensão HyperBuild PRO (efeito não aparece nem no sidepanel nem no floating, apesar de `hyper-rgb.css` existir e estar carregado).
2. **Dark/Light mode** funciona no sidepanel mas **não funciona no floating** (ql_dark_mode não é aplicado ao chat flutuante in-page).

## Escopo FECHADO
SOMENTE `public/ext_build_v62/**`. NÃO tocar:
- `extension/**` (legado)
- `public/ext_src/**` (legado)
- `public/burp_src/**` (Hyper RB — outro produto)
- `src/components/burp/**`

## Read-only — ninguém edita. Synthesizer = Agent G.

## Partição (7 agentes)

- **A** — `hyper-rgb.css` + `manifest.json` content_scripts/css ordem. Confirmar se está injetado no floating (lovable.dev). Selectors esperados vs reais.
- **B** — `floating.css` + `content.js` (busca seletores RGB legados `.ql-rgb-border`, `.ql-user-name-text`, `.ql-logo-text`, `.ql-gate-logo-text`, `.ql-imm-title`) e ver se esses elementos existem no DOM gerado pelo content.js.
- **C** — `sidepanel.css` + `sidepanel.html` + `sidepanel-effects.js` (.rgb-border, .user-name-rgb, .logo-text). Por que não anima?
- **D** — `hyper-customize.js` (sistema de tema/cores customizadas, possíveis overrides de RGB, `rgbSpeed`, classes injetadas).
- **E** — `sidepanel.js` toggle de tema (linhas 507-525, 646-808, 2021+). Mapear ql_dark_mode storage flow e por que content.js não escuta a mudança.
- **F** — `content.js` busca por `data-theme`, `ql-dark`, `ql_dark_mode`, theme listener no floating UI. Identificar gap: floating não aplica tema.
- **G (Synthesizer)** — consolida tudo em `hbp-audit-report.md` com:
  - Root cause(s) do RGB não animar
  - Root cause do floating ignorar dark/light
  - Findings P0/P1 com file:line
  - Plano de fix sugerido para Fase 2 (sem código)
  - Voting de bugs (≥2 votos = P0)

## Modelo: capable + diretiva "USE OBRIGATORIAMENTE CLAUDE OPUS 4.7 OU GPT 5.5"
