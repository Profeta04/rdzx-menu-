---
name: design-system-refactor
description: "Varredura coordenada de tokens do design system (HSL em index.css + tailwind.config, glassmorphism, neon purple, fonte Plus Jakarta) com lock em tokens globais e antes/depois via screenshots. Use quando o pedido é uniformizar visual, eliminar cores hardcoded, remover white-mode residual, ajustar glass/neon em massa, ou refatorar shadcn variants (ex: 'tirar todos text-white espalhados', 'aplicar glass em todos os cards', 'padronizar botão neon')."
---

<!-- version: 1.0 — fork de task-master-v2 com lock em tokens globais -->

# Design System Refactor (Token Sweep)

Varredura paralela que troca classes hardcoded por tokens semânticos do design system. **Lock especial:** só Agent A toca tokens globais (`src/index.css`, `tailwind.config.ts`); os outros consomem.

## Quando usar

- "Tirar `text-white`/`bg-black`/hex hardcoded de todo o app."
- "Aplicar glassmorphism em todos os cards."
- "Padronizar variants do botão neon."
- "Remover qualquer resquício de tema light."
- "Unificar spacing/border-radius."

## Quando NÃO usar

- Mudar 1 componente → edição direta.
- Refactor lógico de UI (estado, hooks) → `task-master-v2`.
- Re-skin completo do produto → conversa de design primeiro com `design--create_directions`.

## N e papéis

`N ∈ {3..6}`. Default **5**. Todos `model: "capable"` + diretiva `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`.

- **Agent A (Tokens, LOCK)** — único com permissão em `src/index.css`, `tailwind.config.ts`, `components.json`. Define/ajusta variáveis HSL, gradients, sombras, glass. Os outros só **consomem**.
- **Agent B (shadcn Variants)** — `src/components/ui/**`. Cria variants (`cva`) ao invés de inline classes.
- **Agent C (Pages & Admin)** — `src/pages/**`, `src/components/admin/**`. Troca classes hardcoded por tokens.
- **Agent D (Extension CSS)** — `public/ext_build_v62/*.css` + inline styles dos componentes HB PRO (se in-scope). Hyper RB CSS fica de fora salvo pedido explícito.
- **Agent E (Synthesizer)** — roda `browser--screenshot` antes/depois nas páginas principais, escreve `ds-report.md` com galeria visual + lista de tokens criados/usados.

## Waves

- **W1 (Tokens):** SPAWN só A. Define/ajusta tokens. Sem A, ninguém pode rodar.
- **W2 (Consume):** SPAWN B + C + D em paralelo. Cada um troca hardcodes pelos tokens de A.
- **W3 (QA):** SPAWN E. Screenshots + report + checagem de regressão visual.

## Arquivos de coordenação

Prefixo **`ds-`**: `ds-plan.md`, `ds-inbox-A..E.md`, `ds-tokens-spec.md` (A escreve no fim da W1), `ds-report.md` (E na W3).

## Regras invioláveis

1. **Só Agent A** edita `src/index.css` ou `tailwind.config.ts`.
2. **Todas cores em HSL** (regra do projeto).
3. **Sem `text-white`/`bg-black`/hex** no resultado final — só tokens semânticos.
4. **Não tocar Hyper RB** (`public/burp_src/**`, `src/components/burp/**`) salvo pedido explícito.
5. **HB PRO extension CSS:** Agent D edita SOMENTE em `public/ext_build_v62/**` (fonte de verdade).
6. **Dark-only:** projeto não tem toggle de tema. Não introduzir variants `light:`.
7. **shadcn:** preferir `cva` variants a className inline gigante.

## Encerramento

`Design System Refactor · N=<n> · X tokens criados · Y arquivos uniformizados · screenshots em ds-report.md · archive em .agents/archive/<ts>/`

## Anti-padrões

- ❌ Qualquer agente além de A tocar tokens globais.
- ❌ Deixar `text-white`/`bg-black` no diff final.
- ❌ Cor fora de HSL.
- ❌ Introduzir light mode.
- ❌ Editar Hyper RB sem pedido.
- ❌ Fechar sem screenshot antes/depois.