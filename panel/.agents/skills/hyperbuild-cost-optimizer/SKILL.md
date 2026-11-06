---
name: hyperbuild-cost-optimizer
description: Reduce Lovable Cloud cost on HyperBuild backend (Supabase). Use when user reports high usage, slow queries, or asks to optimize edge functions, audit log, heartbeats, AI API spend, or storage. Covers diagnosis steps, top fix patterns (drop duplicate triggers, debounce heartbeats, cache cold reads, parallelize, AI model selection), and a pg_cron maintenance contract.
---

# HyperBuild Cost Optimizer

Skill applied whenever a user asks to lower Lovable Cloud / Supabase spend, or to make backend faster/lighter without changing the extension. The patterns here were proven on `/vx`, `/heartbeat`, `/pc`, `/gn`, `/gp`, `/gv`, `fraud-alerts`, `/ai`, and the audit pipeline.

> **Context:** Hyper RB v4.0.7. Extension source lives in `public/burp_src/`. The AI gateway proxy lives at `supabase/functions/ai/`.

## Golden rules

1. **Never require an extension update.** The extension is published — all wins must come from Postgres + Edge Functions.
2. **Preserve security posture.** Rate limits, HMAC validation, hardware lock, fraud logging are non-negotiable. Optimize *around* them, not by removing them.
3. **Measure before cutting.** Always run the diagnosis block below and quote real numbers (rows/day, MB, invocations) before proposing changes.
4. **One migration per concern.** Schema/trigger/function changes go through `supabase--migration`. Cron schedules + grants go through `supabase--insert` (they include the publishable key and must not run on remix).

## Diagnosis block (always run first)

```sql
-- Top tables by row count + size
SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables WHERE schemaname='public'
ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;

-- Audit log growth (the #1 silent cost driver)
SELECT date_trunc('day', created_at) d, count(*) FROM admin_audit_log
WHERE created_at > now() - interval '7 days' GROUP BY 1 ORDER BY 1 DESC;

-- Duplicate triggers
SELECT tgname, tgrelid::regclass FROM pg_trigger
WHERE NOT tgisinternal AND (tgname LIKE 'audit_%' OR tgname LIKE 'trg_audit_%')
ORDER BY tgrelid::regclass::text;

-- Hot edge functions (last 24h)
-- use supabase--analytics_query with function_edge_logs grouped by function_id
```

## Pattern catalog

### P1 — Drop duplicate audit triggers + filter service_role

Symptom: `admin_audit_log` is the biggest table; each row mostly contains diffs from edge-function-driven UPDATEs.

Fix:
- Keep exactly one trigger per table; canonical name is `trg_audit_<table>`.
- `fn_audit_trigger` must early-return when `auth.role() = 'service_role'` OR `auth.uid() IS NULL`.
- Also skip noop updates: `IF TG_OP='UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;`
- Schedule `purge_old_admin_audit_log(30)` via `run_maintenance_purges()` daily.

Expected: −70 to −85% writes to audit_log.

### P2 — Heartbeat debounce in `/vx` and `/heartbeat`

**Note:** Two distinct edge functions handle heartbeat traffic: `vx` (legacy activation + heartbeat combined) and `heartbeat` (standalone heartbeat). Apply the debounce to both.

Symptom: Heartbeat functions dominate invocations; every active user fires every 60s.

Fix (server-side, no extension change):
- On `heartbeat=true`, look up `sessions.last_heartbeat`. If `< 90s` ago → only `UPDATE last_heartbeat` and return early. Skip `increment_license_editing_time` RPC and the online-count SELECT.
- Move stale session cleanup out of the hot path. Replace the per-request UPDATE-where-old with a `pg_cron` job calling `cleanup_stale_sessions()` every 2 minutes.
- Replace `select("*")` on `licenses` with explicit column list.

Expected: −60 to −75% DB work on heartbeat functions.

### P3 — Parallelize sequential awaits in `/pc` and `fraud-alerts`

Pattern: any `await A; await B;` where B does not depend on A becomes `Promise.all([A, B])`.

High-value targets:
- `/pc`: license SELECT + `isRateLimitedByLicense` → parallel.
- `fraud-alerts`: per-event-type loop → `Promise.all(Object.entries(THRESHOLDS).map(async ...))`. Load `admin_telegram` once outside the loop.

Side benefit: reduces total edge-function execution time (Lovable Cloud bills by GB-s).

### P4 — `/pc` jitter budget

Original anti-bot jitter was 50–250 ms. Drop to 0–100 ms (`Math.floor(Math.random()*100)`). Same fingerprint defense, ~150 ms cheaper per call.

### P5 — Cold-cacheable lists (`gn`, `gp`, `gv`)

These return data that changes ≤ once an hour but are polled by every extension instance.

Fix:
- Add `Cache-Control: public, max-age=60, s-maxage=60` (notifications) or `max-age=120` (packages/versions).
- Replace `select("*")` with explicit columns.

Expected: −40 to −60% repeat invocations after CDN warm-up.

### P6 — pg_cron maintenance contract

There must be exactly two cron jobs owning recurring DB cost:

| Job | Schedule | Purpose |
|---|---|---|
| `run-maintenance-purges-daily` | `30 3 * * *` | Calls `public.run_maintenance_purges()` — purges audit, usage, errors, validation attempts, security, fraud, heartbeats, api_logs; nonces + stale sessions + heartbeats `pings_today` reset. |
| `cleanup-stale-sessions-2min` | `*/2 * * * *` | Calls `cleanup_stale_sessions()` so `/vx`/`/heartbeat` don't have to. |

Schedule cron jobs through `supabase--insert` (never migration — contains publishable key).

### P7 — SECURITY DEFINER hygiene

After creating any new `SECURITY DEFINER` purge/maintenance function, immediately:
```sql
REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM PUBLIC, anon, authenticated;
```
Only the cron runner (postgres) should call them.

### P8 — AI Gateway model selection (`/ai`)

The `/ai` edge function proxies requests to Lovable AI Gateway. Model choice drives cost directly (billed by input+output tokens × model tier).

**Current default:** `google/gemini-3-flash-preview` (set in `supabase/functions/ai/index.ts`)

**Lovable AI Gateway — supported models:**

| Model | Tier | Best for |
|---|---|---|
| `google/gemini-2.5-flash` | cost-efficient default | Chat, explain, classify, most tasks |
| `google/gemini-2.5-flash-lite` | cheapest | Short summaries, low-context tasks |
| `google/gemini-2.5-pro` | premium reasoning | Complex multi-step reasoning, code analysis |
| `google/gemini-3-flash-preview` | preview/current default | General-purpose, balanced cost |
| `google/gemini-2.5-flash-image` | image (nano banana) | Image generation / vision tasks |
| `openai/gpt-5-nano` | cheapest OpenAI | Minimal tasks, fill-in, nano tier |
| `openai/gpt-5-mini` | cost-efficient OpenAI | Chat, explain, classify |
| `openai/gpt-5` | standard | General reasoning |
| `openai/gpt-5.2` | advanced | Enhanced reasoning |
| `openai/gpt-5.4` | pro tier | High-quality generation |
| `openai/gpt-5.5` | pro | Critical tasks, high-quality output |
| `openai/gpt-5.5-pro` | premium | Mission-critical, best output quality |

**Recommendation by workload:**

| Use case in `/ai` | Recommended model |
|---|---|
| `explain_lovable_request` (current action) | `google/gemini-2.5-flash` or `gemini-2.5-flash-lite` |
| Chain/flow analysis with reasoning | `google/gemini-2.5-pro` |
| Short action classification | `google/gemini-2.5-flash-lite` or `openai/gpt-5-nano` |
| Image/screenshot analysis | `google/gemini-2.5-flash-image` |
| Critical code generation | `openai/gpt-5.5` or `openai/gpt-5.5-pro` |

**Cost fix:** The current default `gemini-3-flash-preview` is a preview model with unpredictable pricing. Switch to `google/gemini-2.5-flash` for stable, lower cost on the `explain_lovable_request` action. Only escalate to pro/gpt-5.5 for explicitly complex tasks.

```typescript
// supabase/functions/ai/index.ts — line 33
const DEFAULT_MODEL = "google/gemini-2.5-flash"; // was gemini-3-flash-preview
```

**Rate limit already in place:** 30 req/min per IP via `security_logs` — do not loosen. Consider lowering to 10 req/min if AI costs spike unexpectedly.

Expected: −30 to −50% AI token cost by switching from preview to stable flash.

### P9 — Chatty/logging cost awareness

When `task-master-v2` runs in **Chatty-on** mode it generates up to 8 progress notes per wave per agent (5 agents × 8 = 40 notes/wave). Each note is an AI call. Over N waves this compounds.

Fix:
- Use `gemini-2.5-flash-lite` or `gpt-5-nano` for progress-note generation — they are sufficient for short status strings.
- Cap actual note content to ≤3 lines per call as specified in the protocol (already enforced by TM2).
- In steady-state monitoring (heartbeat-style agent loops), prefer flash-lite for periodic logs.

## Anti-patterns (do NOT do)

- Removing `validateExtensionRequest`, `isRateLimitedByIp`, or HMAC just to save CPU.
- Caching license validation responses (security risk — license can be revoked any second).
- Adding a check constraint with `now()` (Postgres requires CHECKs to be immutable).
- Dropping `trg_audit_licenses` entirely. Keep one trigger; the service_role filter handles the volume.
- Editing the extension. If a fix needs the extension, find a server-side equivalent first (debounce, cache, server-injected templates).
- Using a premium AI model (`gpt-5.5-pro`, `gemini-2.5-pro`) for routine `explain_lovable_request` calls.

## Closing checklist

Before declaring an optimization pass done:
- [ ] Diagnosis numbers quoted in the response (rows, MB, invocations).
- [ ] Migration applied, linter warnings reviewed.
- [ ] Cron jobs scheduled via `supabase--insert`.
- [ ] Edge functions edited (auto-deploy on save — do not tell user to deploy).
- [ ] No extension files (`public/burp_src/`) touched unless explicitly required.
- [ ] Response shape preserved on `/vx`, `/heartbeat`, `/pc`, `/gn`, `/gp`, `/gv` (extension still parses it).
- [ ] Estimate of cost reduction stated per pattern applied.
- [ ] AI model choice logged and justified if changed from default.
