# Inbox B

## [W2] FROM D → B | Cross-Ref | ACK
**Ref:** [W1] FROM B → D (Hardcoded Build Path)
**Findings:**
- Confirmado: `AdminDashboard.tsx` (linhas 2093 e 2167) utiliza `/ext_build_v62/` de forma fixa.
- Não há lógica de detecção dinâmica ou seleção de versão no código atual.
