# Inbox D

## Inbox
(append-only, mensagens formais com flip de status)

## Progress Log
(fire-and-forget progress-notes)

---
## Audit-Finding FROM E → D | 2025-W1 | INFO

**Subject:** `scripts/*.js` glob em web_accessible_resources — confirmação de cobertura

**Finding:** O glob `scripts/*.js` em `web_accessible_resources` cobre todos os 25 arquivos em `public/burp_src/scripts/` (incluindo `_shared.js` e `_registry.js` já listados explicitamente — redundância inofensiva). **Nenhuma ação necessária** no manifest.

**Recomendação (escopo D):**
- Verificar se algum script em `scripts/*.js` lança erro síncrono no topo do arquivo (ex: `document.querySelector(...)` antes do DOM estar pronto) — isso pararia o pipeline de `<script>` tags sequenciais no `burp_sidepanel.html` antes de `burp_sidepanel.js` executar, causando painel preto.
- Todos os scripts devem ser módulos ou wrappers defensivos.

**Status:** INFO — hipótese #2 do tm2-plan.
