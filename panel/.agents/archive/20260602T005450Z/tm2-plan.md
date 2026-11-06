# TM2 Plan — Auditoria HyperBuild Skills

**Objetivo:** Auditar as 8 skills `hyperbuild-*` em `.workspace/skills/`, identificar oportunidades de melhoria (clareza, completude, alinhamento com estado atual do projeto Hyper RB v4.0.7, anti-padrões, redundâncias, gaps) e aplicar atualizações via draft em `.agents/skills/<name>/` + `skills--apply_draft`.

**N escolhido: 5**
Justificativa: 8 skills independentes + camada cross-cutting de consistência entre elas; partição disjunta clara por domínio (núcleo extensão, network, backend, ops/release, cross-cutting). Volume estimado > 1200 LOC de markdown reescrito potencialmente.

**Chatty: on**

## Contrato de Escopo (DISJUNTO)

- **Agent A — Núcleo Extensão**
  - `.workspace/skills/hyperbuild-burp-lovable-master/`
  - `.workspace/skills/hyperbuild-extension-architect/`
  - Escrita: drafts em `.agents/skills/hyperbuild-burp-lovable-master/`, `.agents/skills/hyperbuild-extension-architect/`

- **Agent B — Network & Captura**
  - `.workspace/skills/hyperbuild-network-scripts/`
  - `.workspace/skills/hyperbuild-send-method-rollout/`
  - Escrita: drafts correspondentes em `.agents/skills/`

- **Agent C — Backend & Licença**
  - `.workspace/skills/hyperbuild-edge-functions/`
  - `.workspace/skills/hyperbuild-licensing-flow/`
  - Escrita: drafts correspondentes em `.agents/skills/`

- **Agent D — Ops, Custo & Release**
  - `.workspace/skills/hyperbuild-cost-optimizer/`
  - `.workspace/skills/hyperbuild-release-packager/`
  - Escrita: drafts correspondentes em `.agents/skills/`

- **Agent E — Cross-cutting + Migrations (lock)**
  - Auditoria de consistência entre as 8 skills: naming, cross-references, sobreposições, gaps, glossário comum, alinhamento com estado real do projeto (manifest v4.0.7, edge functions ativas, schema atual).
  - `supabase/migrations/**` reservado (não há mudança de schema esperada nesta task, mas o lock se aplica).
  - Escrita: pode criar `.agents/skills/_hyperbuild-shared-glossary/` se justificar; pode enviar `Edit-Request` para A/B/C/D padronizarem trechos.

## Regras

1. NUNCA editar diretamente em `.workspace/skills/` — só drafts em `.agents/skills/<name>/`.
2. Para cada skill modificada: copiar primeiro o SKILL.md atual para `.agents/skills/<name>/SKILL.md`, depois editar.
3. Aplicar draft com `skills--apply_draft` SOMENTE na Wave final, após ACK do Orchestrator (não aplicar dentro da wave).
4. Sem mudanças no código da extensão / edge functions nesta task — apenas conteúdo das skills.
5. Antes de propor mudança grande: ler estado real do projeto (manifest, edge functions, schema) para garantir alinhamento.

## Status

Status: In Progress
Wave: 1

---

## Wave 1 — kickoff

Spawn paralelo de A, B, C, D, E. Cada agente:
1. Lê seu inbox e o plan.
2. Lê suas skills atuais em `.workspace/skills/`.
3. Lê estado real do projeto (arquivos relevantes da extensão / backend / migrations) para validar.
4. Produz draft revisado em `.agents/skills/<name>/SKILL.md`.
5. Envia `Edit-Request` / `Audit-Finding` para outros agentes onde detectar inconsistência cruzada.
6. Reporta achados em ≤25 linhas.