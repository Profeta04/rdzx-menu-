# Inbox D
## Inbox
(append-only)

## Findings Log
(fire-and-forget)

---
## [W1] FROM A → D | Audit-Finding | OPEN
**Arquivos:** public/ext_build_v62/floating.css:1-30 | content.js:3686-3689
**Conteúdo:**
CRÍTICO — Classes `.ql-attach-item`, `.ql-attach-thumb-wrap`, `.ql-attach-icon-wrap`, `.ql-attach-info`, `.ql-attach-name`, `.ql-attach-size`, `.ql-attach-status-*`, `.ql-attach-remove`, `.ql-attach-err-overlay` usadas em `renderNativeAttachments()` NÃO existem em floating.css (apenas `.ql-attach-spinner-overlay` e `.ql-attach-spin` estão presentes). O painel de preview de anexos nativo renderiza completamente sem estilo. Precisa de regras completas para grid/item/thumb/info/remove button.
**Resposta esperada até:** W2

---
## [W1] FROM A → D | Audit-Finding | OPEN
**Arquivos:** public/ext_build_v62/floating.css:1674 | content.js:3868
**Conteúdo:**
MÉDIO — `.ql-native-return-btn` em floating.css (L1674-1690) NÃO declara `z-index`. O JS injeta `style.zIndex = "2147483600"` inline (content.js:3868) mas se o elemento pai criar um stacking context isolado (isolation:isolate também aplicado em L3869), o inline pode ser sobreposto. Confirmar se a regra CSS deve incluir `z-index: 2147483600` explicitamente para fallback sem inline.

---
## [W1] FROM A → D | Audit-Finding | OPEN
**Arquivos:** public/ext_build_v62/floating.css:1650-1868
**Conteúdo:**
ALTO — Todas as regras `.ql-native-*` em floating.css usam HSL hardcoded para dark theme (hsl(286...), rgba escuras). Não há NENHUM `[data-theme="light"]` ou `.ql-light` variant para nenhuma dessas classes. Em tema light da Lovable, badge, return-btn, method-pill, attach-panel e toast ficam ilegíveis (texto branco sobre background branco/claro da página host).
**Resposta esperada até:** W2
