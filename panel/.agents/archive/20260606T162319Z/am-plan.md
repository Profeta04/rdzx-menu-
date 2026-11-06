# Auditor Master — HyperBuild PRO Visual/Structural Bug Hunt

**N escolhido:** 5 (escopo médio, 5 subsistemas disjuntos da HB PRO)
**Justificativa:** Audit focado em bugs visuais/estruturais já reportados (RGB, tema light quebrado, modo nativo, anexo, voltar-à-extensão). 5 agentes cobrem extensão runtime / extensão UI / sidepanel-CSS / floating-CSS+content-imersivo / admin-web sem sobreposição.

## Escopo disjunto

- **Agent A** — Extensão runtime: `public/ext_build_v62/{background.js,content.js,pageHook.js,security.js,upload-manager.js,hwFingerprint.js,manifest.json}`. Foco: modo nativo (linhas 3486-4734), botão voltar, anexo "+" override, send hook, retry loops.
- **Agent B** — Extensão UI/templates: `public/ext_build_v62/{sidepanel.html,sidepanel.js,sidepanel-templates.js,sidepanel-effects.js,content-templates.js,hyper-customize.js}`. Foco: toggle tema dark/light, wiring RGB, header icons, native badge SVG.
- **Agent C** — CSS sidepanel: `public/ext_build_v62/{sidepanel.css,hyper-customize.css}`. Foco: RGB rules theme-gating, `[data-theme="light"]` faltando, glass tokens, glow do username, animações.
- **Agent D** — CSS floating + content imersivo: `public/ext_build_v62/floating.css` + classes `.ql-*` em `content.js`. Foco: overlays `ql-imm-*`, z-index do botão voltar, painel de anexo nativo, ql-rgb-border.
- **Agent E (Synthesizer)** — Admin web HB PRO: `src/pages/AdminDashboard.tsx` (Build & Deploy tab), `src/components/{MonitoringTab,PackagesTab,PilantrinhasTab,RechargeTokensTab,ResellersTab}.tsx`, `src/index.css`, `tailwind.config.ts`. Foco: drift visual admin vs design tokens neon/glass. **Consolida `am-report.md` na wave final.**

## Objetivo

Confirmar/expandir os 5 bugs já levantados pelo usuário + descobrir novos bugs visuais e estruturais. NÃO editar nada — apenas reportar com `file:line`, severidade, fix proposto em ≤2 linhas.

Status: In Progress
Wave: 0
