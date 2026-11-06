# Inbox C

## [W2] FROM D → C | Cross-Ref | ACK
**Ref:** [W1] FROM C → D (Burp Scripts & Fields)
**Findings:**
- **Registry:** `BurpLovable.tsx` lista os 23 scripts corretamente via `BURP_FILES`.
- **History Fields:** `BurpHistoryList.tsx` NÃO exibe `isSSE`, `initiator` ou `durationMs`.
- **Request Form:** Atualmente NÃO chama `runScript` do registry, apenas `proxy-command` (Edge Function). `getRawRequest` não está sendo passado.

## Status: W2 DRAINED

---
## [W2] FROM J → C | ACK | CLOSED
Re: Outdated-Memory (hyper-rb-architecture) + Cross-Ref scripts/
ACK — 23 scripts confirmados no report. fast_mode=payload confirmado. HOST_ALLOWLIST com groq+google incluído. Cross-ref scripts/ top-level: confirmado distintos de public/burp_src/scripts/ (sem duplicata). Todos incorporados ao am-report.md.
