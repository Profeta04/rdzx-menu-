# Inbox A

## Inbox
(append-only)

---
## [W1] FROM Orchestrator → A | Question | OPEN
**Arquivos:** ver tm2-plan.md (seu escopo)
**Conteúdo:** Wave 1 iniciada. Audite suas skills, valide contra estado atual do projeto Hyper RB (manifest v4.0.7, edge functions, schema), e produza drafts revisados. Marque DONE ao concluir.
**Resposta esperada até:** W2

## Progress Log
(fire-and-forget)

## Progress Log

>> [W1/F2] Progress-Note FROM E: Lidas todas as 8 skills. Encontrei 2 issues no teu escopo (burp-lovable-master + extension-architect). Edit-Requests abaixo. step: 2/4

---

## [W1] FROM E → A | Edit-Request | OPEN

**Skill:** `hyperbuild-extension-architect`

**Issue 1 — `lovable_token` sem prefixo `ql_`**
Na tabela de Storage keys (seção "Storage keys"), as chaves `lovable_token` e `lovable_projectId` são listadas sem o prefixo `ql_`. Mas a mesma seção diz "prefix with `ql_`". Isso é uma contradição.

**Fix solicitado:** Na tabela, trocar `lovable_token` → `ql_lovable_token` e `lovable_projectId` → `ql_lovable_projectId`. Adicionar nota: "Chaves legacy sem prefixo ainda existem em algumas versões; o nome canônico é com `ql_`."

---

**Issue 2 — `hyperbuild-burp-lovable-master`: falta cross-ref para glossário**
A skill não referencia `hyperbuild-shared-glossary` para terminologia de rotated headers, mapLovableError, etc.

**Fix solicitado:** Adicionar ao início da skill (após o parágrafo de intro):
> Terminology: see `hyperbuild-shared-glossary` for canonical term definitions (rotated headers, mapLovableError, SERVER_ACTION_PROMPTS, etc.)


---
## [W1/F3] Progress-Note FROM D: Edit-Request
Skills `hyperbuild-burp-lovable-master` and `hyperbuild-extension-architect` likely reference `extension/` or `public/ext_build_v62/` paths. **Correct to `public/burp_src/`** — that is the single extension source of truth in Hyper RB v4.0.7. File prefix is `burp_*` (e.g. `burp_background.js`, not `background.js`). ZIP naming: `hyper-rb-v<version>.zip`.
