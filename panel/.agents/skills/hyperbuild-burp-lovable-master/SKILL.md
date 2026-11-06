---
name: hyperbuild-burp-lovable-master
description: Specialist for building HyperBuild edge functions that proxy requests to the Lovable API (api.lovable.dev, lovable.dev, lovable.app). Use when creating or editing any function that calls Lovable upstream — chat (/pc), project creation (/cp), file upload (/uf), Burp replay (/burp), or any new Lovable endpoint. Covers anti-block header/IP rotation, SSRF protection, license + HMAC pipeline, retry with backoff, Lovable error mapping, server-side prompt injection, and the migration plan for legacy functions that still use static fingerprints.
---

# HyperBuild Burp Lovable Master

The proxy layer that calls Lovable's private API on behalf of licensed users is the single most sensitive surface of HyperBuild. Read this skill **before writing any `fetch()` to `api.lovable.dev`, `lovable.dev`, or `lovable.app`**. Pair with `hyperbuild-edge-functions` (base skeleton) and `hyperbuild-licensing-flow` (license gating).

## Current Lovable-egress catalog (audited — v4.0.7)

Only these four edge functions are allowed to egress to Lovable. Anything else calling Lovable is a bug.

| Fn | Endpoint(s) called | Purpose | Status |
|---|---|---|---|
| `pc` | `POST /projects/:id/chat` | Chat proxy + server-side action prompts (`remove_watermark`, etc.). | ✅ **Canonical**. Uses `buildRotatedHeaders`, `fetchWithRetry`, `mapLovableError`, `SERVER_ACTION_PROMPTS`, per-IP + per-license rate limit. Accepts `fast_mode: boolean` (default `true`). |
| `cp` | `GET /user/workspaces`, `POST /workspaces/:wsId/projects` | Create project. | ⚠️ **Legacy**. Static Bearer from client body, no rotation, no retry, no error mapping. On migration list. |
| `uf` | `POST /projects/:id/files/generate-upload-url`, `PUT <signed url>`, `POST /files/generate-download-url` | Upload file proxy. | ⚠️ **Legacy**. Same as `/cp` + unsigned PUT URL must be allowlisted (`ALLOWED_LOVABLE_STORAGE`). |
| `burp` | Generic replay (caller URL constrained to `lovable.dev`, `lovable.app`, `supabase.co`) | Power-user request replay. | ⚠️ **Mixed**. Has SSRF guard but single hard-coded UA, no retry, no error mapping. |

`op` calls `api.groq.com` / `api.openai.com` — not Lovable, out of scope; same rotation/retry pattern applies.

Inventory check before adding a new Lovable call:
```bash
rg -n 'lovable\.(dev|app)' supabase/functions/
```

## Hard rules (non-negotiable)

1. **Only edge functions may call Lovable upstream.** Never client. Never another backend.
2. **Allowlist hosts** via regex:
   ```ts
   const ALLOWED_LOVABLE: RegExp[] = [/(^|\.)lovable\.dev$/i, /(^|\.)lovable\.app$/i];
   // For /uf signed PUT — separate allowlist:
   const ALLOWED_LOVABLE_STORAGE: RegExp[] = [/\.amazonaws\.com$/i, /\.storage\.googleapis\.com$/i, /\.r2\.cloudflarestorage\.com$/i];
   ```
   Never merge Lovable and storage allowlists.
3. **SSRF guard mandatory** before every fetch — reject private IPs, loopback, link-local, `169.254.169.254`, `.internal`, `.local`, IPv6 ULA/loopback. Copy `isPrivateHost` from `burp/index.ts`.
4. **Always rotate headers** via `buildRotatedHeaders(token)`. Static UA = blocked within hours.
5. **Always wrap upstream calls in `fetchWithRetry`** (max 3 attempts, exponential backoff `500 * 3^(n-1)` ms, **no retry on 4xx**).
6. **Always run `validateExtensionRequest` + license + per-license rate limit** before any upstream call.
7. **Never echo Lovable's raw error body.** Map through `mapLovableError()` → `{ error_code, error_display, user_action, retryable }`. **Never rename existing codes** — old extension versions parse them.
8. **Lovable token is server-stored, never accepted from client body.** Source via `getLicenseLovableToken(supabase, license_key)`. Legacy `/cp` and `/uf` accept `token_lovable` from body — known debt; new functions must NOT replicate it.
9. **Server-side prompt injection only.** `SERVER_ACTION_PROMPTS` lives on the server. Client sends `action: "remove_watermark"` — never the prompt text.

## Shared module (target architecture)

Canonical helpers live inline in `supabase/functions/pc/index.ts`. **By the third Lovable-proxy function they must be lifted** to `supabase/functions/_shared/lovable.ts`. Do not copy/paste — drift defeats header rotation.

Target export surface for `_shared/lovable.ts`:
```ts
export const ALLOWED_LOVABLE: RegExp[];
export const ALLOWED_LOVABLE_STORAGE: RegExp[];
export function isPrivateHost(hostname: string): boolean;
export function assertAllowedUpstream(url: string, scope: "lovable" | "storage"): void;
export function buildRotatedHeaders(authToken: string): Record<string, string>;
export function buildRotatedStorageHeaders(): Record<string, string>;
export async function fetchWithRetry(url: string, init: RequestInit, maxAttempts?: number): Promise<Response>;
export function mapLovableError(status: number, rawBody: string): MappedError;
export async function getLicenseLovableToken(supabase, licenseKey: string): Promise<{ token: string; license: LicenseRow }>;
export function maskToken(t: string): string;
```

Until the lift happens, **copy verbatim from `pc/index.ts`** — never define a new pool.

## The fetch pattern (memorize)

```ts
import { buildRotatedHeaders, fetchWithRetry, mapLovableError, assertAllowedUpstream } from "../_shared/lovable.ts";

assertAllowedUpstream(apiUrl, "lovable");  // throws → caught → 400

const resp = await fetchWithRetry(apiUrl, {
  method: "POST",
  headers: buildRotatedHeaders(activeToken),
  body: JSON.stringify(upstreamBody),   // include fast_mode: boolean if applicable
}, 3);

const text = await resp.text();
if (!resp.ok) return jsonResponse(mapLovableError(resp.status, text), resp.status);
```

## Header rotation (canonical pools)

Lives in `pc/index.ts`. Reuse verbatim — never define a divergent local pool:
- `UA_POOL` — 6+ modern Chrome/Safari/Firefox UAs (bump to current Chrome stable every 60–90 days; outdated UAs fingerprint the bot).
- `LANG_POOL` — `en-US`, `pt-BR`, `en-GB`, `es-ES`.
- `SEC_CH_UA_POOL` — must match Chrome UAs.
- `X-Forwarded-For` / `X-Real-IP` — `randomIpv4()` (skips reserved ranges).
- `X-Request-ID` — `crypto.randomUUID()`.

## Standard skeleton for a NEW Lovable proxy function

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, jsonResponse, genericError, getClientIp,
  isRateLimitedByIp, isRateLimitedByLicense,
  validateExtensionRequest, logFraud, isValidString,
} from "../_shared/security.ts";
import {
  assertAllowedUpstream, buildRotatedHeaders, fetchWithRetry,
  mapLovableError, getLicenseLovableToken, maskToken,
} from "../_shared/lovable.ts";

const SERVER_ACTION_PROMPTS: Record<string, string> = {};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return genericError(405, "Method not allowed");
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const ip = getClientIp(req);
    if (await isRateLimitedByIp(supabase, ip, "<fn>", 60, 1)) return genericError(429, "Muitas requisições.");

    const rawText = await req.text();
    if (rawText.length > 5 * 1024 * 1024) return genericError(413, "Payload muito grande");

    const ext = await validateExtensionRequest(supabase, req, rawText);
    if (ext) return ext;

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawText); } catch { return genericError(400, "JSON inválido"); }

    // Whitelist fields. token_lovable is NOT listed — server-sourced only.
    const allowed = new Set(["license_key", "device_id", "session_id", "projeto_id", "mensagem", "action", "fast_mode", "files"]);
    if (Object.keys(body).some(k => !allowed.has(k))) return jsonResponse({ error: "Payload inválido" }, 400);

    const { license_key, projeto_id, mensagem, action, fast_mode = true, files = [] } = body as any;
    if (!isValidString(license_key, 8, 128)) return jsonResponse({ error: "license_key inválida" }, 400);
    if (await isRateLimitedByLicense(supabase, license_key, "<fn>", 30, 1)) return genericError(429, "Limite por licença atingido.");

    const { license, token: activeToken } = await getLicenseLovableToken(supabase, license_key);
    if (!license || license.status !== "active") return jsonResponse({ error: "Licença inválida" }, 403);
    if (!activeToken) return jsonResponse({ error: "Token Lovable ausente. Faça login em lovable.dev." }, 403);

    let finalMessage = mensagem;
    if (typeof action === "string" && SERVER_ACTION_PROMPTS[action]) finalMessage = SERVER_ACTION_PROMPTS[action];

    const apiUrl = `https://api.lovable.dev/projects/${projeto_id}/chat`;
    assertAllowedUpstream(apiUrl, "lovable");

    const t0 = Date.now();
    const resp = await fetchWithRetry(apiUrl, {
      method: "POST",
      headers: buildRotatedHeaders(activeToken),
      body: JSON.stringify({ mensagem: finalMessage, fast_mode, files }),
    }, 3);
    const text = await resp.text();
    console.log(`[<fn>] event=upstream status=${resp.status} ms=${Date.now()-t0} license=${maskToken(license_key)} project=${projeto_id}`);

    if (!resp.ok) {
      const mapped = mapLovableError(resp.status, text);
      if (mapped.error_code === "AUTH_FAILED") {
        await supabase.from("licenses").update({ lovable_token: null }).eq("id", license.id);
        await logFraud(supabase, { event_type: "lovable_auth_failed", severity: "warn", license_key, device_id: license.device_id, ip, user_agent: req.headers.get("user-agent") ?? "", endpoint: "<fn>" });
      }
      return jsonResponse(mapped, resp.status);
    }
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return jsonResponse({ ok: true, data });
  } catch (e) {
    console.error("[<fn>] error:", (e as Error).message);
    return genericError(500, "Erro interno");
  }
});
```

## Error mapping cheatsheet (`mapLovableError`)

| Upstream | `error_code` | `retryable` | User action |
|---|---|---|---|
| `428` / `captcha_required` | `CAPTCHA_REQUIRED` | false | "Acesse lovable.dev, resolva o captcha, tente novamente." |
| `401` / `403` | `AUTH_FAILED` | false | "Faça login novamente em lovable.dev." + server invalidates stored token |
| `404` | `PROJECT_NOT_FOUND` | false | "Verifique o ID do projeto." |
| `429` | `RATE_LIMITED` | true | "Aguarde alguns segundos." |
| `5xx` | `UPSTREAM_UNAVAILABLE` | true | "Lovable instável, tente novamente." |
| network/timeout | `NETWORK_ERROR` | true | "Falha de rede, tente novamente." |
| anything else | `UPSTREAM_<status>` | false | "Tente novamente. Se persistir, contate o suporte." |

Client switches on `error_code`. **Never rename existing codes.**

## License token handling

- Token is **per-license**, stored in `licenses.lovable_token`.
- Captured client-side by `burp_pageHook.js` → background SW → sync function. The sync function is the **only** permitted entry point for a Lovable token from the client.
- On `AUTH_FAILED`: set `licenses.lovable_token = null` immediately; client re-prompts user to re-login on lovable.dev.
- **Mask in logs**: `token.slice(0, 6) + "••••" + token.slice(-4)`. Never log the raw Bearer.

## Real-IP rotation fallback

If Supabase egress IP is blocked by Lovable:
1. Provision residential/rotating-IP proxy (Bright Data, Oxylabs, IPRoyal). Never free proxies.
2. Set env `LOVABLE_UPSTREAM_PROXY=https://user:pass@host:port`.
3. Deno's `fetch` ignores `HTTP_PROXY`; use `Deno.createHttpClient({ proxy: { url: ... } })`.
4. Cache one `client` per worker invocation (top-level `let`).

## Migration plan for legacy functions

### `/cp`
- [ ] Remove `token_lovable` from body whitelist → fetch via `getLicenseLovableToken`.
- [ ] Replace both `fetch()` calls with `fetchWithRetry` + `buildRotatedHeaders`.
- [ ] Wrap errors in `mapLovableError`. Add `validateExtensionRequest` + per-license rate limit (10/min).
- [ ] `assertAllowedUpstream` on both URLs.

### `/uf`
- [ ] Same token migration as `/cp`.
- [ ] Two-allowlist split: Lovable JSON calls → `ALLOWED_LOVABLE`; signed PUT → `ALLOWED_LOVABLE_STORAGE`.
- [ ] `buildRotatedHeaders(token)` for Lovable calls; `buildRotatedStorageHeaders()` (no Auth) for PUT.
- [ ] Cap `bytes.length` (≤25 MB) **before** decoding base64. Add per-license rate limit (5/min).

### `/burp`
- [ ] Replace hard-coded UA with `buildRotatedHeaders` (Lovable hosts); keep current behavior for `supabase.co`.
- [ ] Wrap in `fetchWithRetry`. Route errors through `mapLovableError` (or document the intentional raw-body leak for debug semantics).

## Anti-patterns (instant rejection)

- `fetch("https://api.lovable.dev/...")` without `buildRotatedHeaders` + `fetchWithRetry`.
- Accepting `token_lovable` from client body in any **new** function.
- Forwarding a user-supplied URL without `assertAllowedUpstream` + `isPrivateHost`.
- Returning Lovable's raw JSON/status to the client.
- Per-function UA/IP pool diverging from `_shared/lovable.ts`.
- Retrying on `4xx`.
- Logging the full Bearer token or upstream raw error body.
- Putting `SERVER_ACTION_PROMPTS` in the client bundle.
- Calling Lovable from `/heartbeat`, `/vx`, `/gn`, `/gp`, `/gr`, `/gu`, `/gv`, `/pp`, `/op`.

## Pre-deploy checklist

- [ ] Imports from `_shared/security.ts` + `_shared/lovable.ts` (no inline pool re-definition).
- [ ] IP rate limit + per-license rate limit (separate counters, separate `action` names).
- [ ] `validateExtensionRequest` before `JSON.parse`.
- [ ] Body field whitelist enforced; `token_lovable` NOT listed.
- [ ] License lookup + `status === "active"` + `device_id` match.
- [ ] Token via `getLicenseLovableToken`, never from client.
- [ ] Every upstream URL passes `assertAllowedUpstream(url, scope)` + `isPrivateHost`.
- [ ] `buildRotatedHeaders` + `fetchWithRetry(_, _, 3)`.
- [ ] Errors via `mapLovableError`; `error_code` matches existing convention.
- [ ] `AUTH_FAILED` → invalidate `licenses.lovable_token` + log fraud.
- [ ] `SERVER_ACTION_PROMPTS` map lives only on the server.
- [ ] Tokens masked in all `console.log` lines; no raw upstream error body logged.
- [ ] Deno test covers: happy path, 401, 429, SSRF, unknown action, missing license.
- [ ] `supabase/config.toml` — `verify_jwt = false` unless explicit reason (extension authenticates via license, not JWT).
