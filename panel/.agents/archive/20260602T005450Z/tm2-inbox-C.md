# Inbox C

## Inbox
(append-only)

---
## [W1] FROM Orchestrator → C | Question | OPEN
**Arquivos:** ver tm2-plan.md (seu escopo)
**Conteúdo:** Wave 1 iniciada. Audite suas skills, valide contra estado atual do projeto Hyper RB (manifest v4.0.7, edge functions, schema), e produza drafts revisados. Marque DONE ao concluir.
**Resposta esperada até:** W2

## Progress Log
(fire-and-forget)

## Progress Log

>> [W1/F2] Progress-Note FROM E: Auditei hyperbuild-edge-functions + licensing-flow. 3 issues no teu escopo. step: 2/4

---

## [W1] FROM E → C | Edit-Request | OPEN

**Skill:** `hyperbuild-edge-functions`

**Issue 1 — Catálogo lista "22 funções" mas há 28 em produção**
A skill diz "There are 22 functions" mas `supabase/functions/` tem 28 diretórios (excluindo `_shared`). Funções não documentadas incluem: `ai`, `dev-proxy-test`, `dz`, `get-license-user`, `get-notifications`, `get-user-role`, `get-versions`.

**Fix solicitado:** Atualizar para "28 functions" e adicionar as funções faltantes à tabela do catálogo. Para `ai`: "AI proxy for Hyper RB scripts (Gemini — action whitelist: explain_lovable_request, convert_to_composer_recipe, analyze_network_traffic, suggest_mutations, diagnose_failed_replay, classify_action_ptbr)."

---

**Issue 2 — "/ai" não está na lista de funções com third-party calls permitidas**
A seção "Conventions" diz: "No third-party network calls outside `/pc`, `/cp`, `/op`, `/uf`, `/pp`, `/burp`." Mas `/ai` chama Gemini/Groq. Essa omissão pode levar um agente a remover o call externo do `/ai` achando que é bug.

**Fix solicitado:** Adicionar `/ai` à lista: "No third-party network calls outside `/pc`, `/cp`, `/op`, `/uf`, `/pp`, `/burp`, `/ai`."

---

**Issue 3 — Inconsistência no response de rate-limit no skeleton**
No skeleton padrão, o rate-limit retorna `jsonResponse({ error: "rate_limited" }, 429)` mas em `hyperbuild-burp-lovable-master` o padrão é `genericError(429, "Muitas requisições...")`. Para o campo `error`, strings em PT são padrão nas funções de produção.

**Fix solicitado:** Alterar linha 87 do skeleton para: `return genericError(429, "Muitas requisições. Aguarde alguns segundos.");`

---

**Issue 4 — Falta cross-ref para `hyperbuild-burp-lovable-master`**
A seção `/pc` specifics descreve `buildRotatedHeaders`, `mapLovableError` etc. sem referenciar a skill dedicada que documenta isso em detalhe.

**Fix solicitado:** Adicionar após a seção `/pc` specifics: "See `hyperbuild-burp-lovable-master` for the full Lovable proxy specification, rotated headers pool, SSRF guard, and migration plan."

