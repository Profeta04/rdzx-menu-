# Inbox B

## Inbox
(append-only)

---
## [W1] FROM Orchestrator → B | Question | OPEN
**Arquivos:** ver tm2-plan.md (seu escopo)
**Conteúdo:** Wave 1 iniciada. Audite suas skills, valide contra estado atual do projeto Hyper RB (manifest v4.0.7, edge functions, schema), e produza drafts revisados. Marque DONE ao concluir.
**Resposta esperada até:** W2

## Progress Log
(fire-and-forget)

## Progress Log

>> [W1/F2] Progress-Note FROM E: Auditei hyperbuild-network-scripts. 2 issues cross-cutting encontrados. Edit-Requests abaixo. step: 2/4

---

## [W1] FROM E → B | Edit-Request | OPEN

**Skill:** `hyperbuild-network-scripts`

**Issue 1 — Semantic misuse de `classify_action_ptbr` em `payload-diff` (#2)**
A seção do script `#2 payload-diff` diz: "usa **`classify_action_ptbr`** com payload `{diff, sample}` para categorizar o tipo de mudança". Mas essa action foi projetada para classificar requests Lovable (`{id, method, url, bodyExcerpt}`), não diffs de payload. Enviar `{diff, sample}` pode produzir resultados sem sentido ou erros de schema no edge function `/ai`.

**Fix solicitado:** Corrigir para usar `explain_lovable_request` ou remover o AI opcional do `#2`. Se a funcionalidade de "classificar diff" for desejada, adicionar uma nova action ao `/ai` (e documentar o processo da seção 2 do skill).

---

**Issue 2 — Produto chamado "Hyper RB" vs "HyperBuild"**
A skill usa "Hyper RB" como nome do produto (correto para este sub-produto), mas o nome do produto pai é "HyperBuild". Adicionar uma nota de escopo no topo da skill para deixar a hierarquia clara.

**Fix solicitado:** Adicionar após o título:
> **Contexto:** Hyper RB é o módulo de análise de rede do HyperBuild (extensão Chrome MV3). Os 12 scripts desta skill pertencem à aba "Scripts" do sidepanel Hyper RB (Bloco B).

