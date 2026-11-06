# Inbox D

## Inbox
(append-only)

---
## [W1] FROM Orchestrator → D | Question | OPEN
**Arquivos:** ver tm2-plan.md (seu escopo)
**Conteúdo:** Wave 1 iniciada. Audite suas skills, valide contra estado atual do projeto Hyper RB (manifest v4.0.7, edge functions, schema), e produza drafts revisados. Marque DONE ao concluir.
**Resposta esperada até:** W2

## Progress Log
(fire-and-forget)

## Progress Log

>> [W1/F2] Progress-Note FROM E: Auditei hyperbuild-cost-optimizer + release-packager. 2 issues de cross-ref encontrados. step: 2/4

---

## [W1] FROM E → D | Edit-Request | OPEN

**Skill:** `hyperbuild-cost-optimizer`

**Issue 1 — Nenhum cross-reference para outras skills**
A skill não menciona `hyperbuild-edge-functions` (onde vivem as funções que estão sendo otimizadas) nem `hyperbuild-burp-lovable-master` (que tem logging discipline e padrões de retry que afetam custo).

**Fix solicitado:** Adicionar ao início da skill:
> Pair with `hyperbuild-edge-functions` (function conventions) and `hyperbuild-burp-lovable-master` (retry/backoff patterns that affect invocation cost).

---

**Skill:** `hyperbuild-release-packager`

**Issue 2 — Nenhum cross-reference para `hyperbuild-extension-architect` ou `hyperbuild-send-method-rollout`**
A skill é silenciosa sobre quando um release deve acontecer vs. o processo de add de método de envio.

**Fix solicitado:** Adicionar ao início da skill:
> Pair with `hyperbuild-extension-architect` (source of truth for extension files) and `hyperbuild-send-method-rollout` (triggers a release as final step).

---

**Issue 3 — Função count em `hyperbuild-edge-functions` (informativo, teu escopo não inclui essa skill)**
Passando para C via inbox-C. Registro aqui apenas para rastreabilidade.

