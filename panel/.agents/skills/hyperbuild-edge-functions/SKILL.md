---
name: hyperbuild-edge-functions
description: Conventions for HyperBuild Supabase Edge Functions (26 functions under supabase/functions/). Use when creating, editing, or debugging any edge function — rate limiting, fraud logging, request validation, the shared security module, /pc Lovable proxy, /vx license validation, /ai AI gateway, /dz ZIP download, admin OTP auth, error response shape.
---

# HyperBuild Edge Functions

All backend logic lives in `supabase/functions/`. There are **26 deployable functions** plus `_shared/` (security, lovable, proxy helpers). Every function uses `SUPABASE_SERVICE_ROLE_KEY` — not the anon key — because extensions don't carry user sessions.

## Function catalog

| Fn | Purpose |
|---|---|
| `vx` | License validation + device binding + session management + heartbeat. Central auth gate for the extension. |
| `pc` | Proxy to Lovable API (chat, fast-mode, watermark removal). Rotates User-Agent / IP / X-Request-ID. Supports proxy rotation via `_shared/proxy.ts`. |
| `cp` | Create Lovable project. |
| `op` | Optimize prompt. |
| `uf` | Upload file proxy. |
| `dz` | Download project ZIP from Lovable. Uses proxy rotation + header rotation + license + device_id strict match. |
| `ai` | AI gateway proxy (Gemini 3 Flash). Actions: `explain_lovable_request`, `convert_to_composer_recipe`, `analyze_network_traffic`, `suggest_mutations`, `diagnose_failed_replay`, `classify_action_ptbr`. System prompts are server-side only. |
| `burp` | Burp suite interceptor proxy (network capture storage). |
| `heartbeat` | Lightweight device telemetry ping — `pings_today` / `pings_total`. **Not a security check** — does NOT call `validateExtensionRequest`. See `/vx` for the security-grade heartbeat. |
| `gn` | Get notifications. |
| `gp` | Get packages. |
| `gr` | Get roles. |
| `gu` | Get user (profile). |
| `gv` | Get versions (extension update check). |
| `pp` | Payment/recharge (extension). |
| `get-notifications` | Admin-facing notification list. |
| `get-versions` | Extension version list. |
| `get-user-role` | Returns roles for a license. Validates `x-license-key` header. |
| `get-license-user` | Returns `user_id` for a license. Validates `x-license-key` header and device_id. |
| `admin-otp-send` | Sends 6-digit Telegram OTP for admin dashboard login. Requires Supabase Bearer JWT + `TELEGRAM_BOT_TOKEN` env. Rate-limit: 8/15 min. |
| `admin-otp-verify` | Verifies the Telegram OTP. Requires Bearer JWT + admin role in `user_roles`. Rate-limit: 5/15 min. OTP is SHA-256 hashed; max 3 attempts; TTL 5 min. Uses `timingSafeEqual`. |
| `verify-admin-key` | Verifies the admin master key. Requires Bearer JWT + admin role. Rate-limit: 10/15 min. Uses `timingSafeEqual`. |
| `bulk-license-ops` | Admin bulk license actions (revoke / delete / extend_days / force_logout). Requires admin JWT + recent OTP (verified in last 5 min). Records in `admin_audit_log`. |
| `fraud-alerts` | Read fraud log for admin. |
| `reseller-api` | Reseller CRUD operations. |
| `reseller-login` | Reseller login: validates `{ email, license_key }` against `resellers` table, creates/updates auth.users, links `user_id`. Client then calls `signInWithPassword`. |
| `dev-proxy-test` | Dev-only proxy rotation smoke test. Gated by `x-dev-license` header matching `DEV_LICENSE_KEY` env. Never call from production. |

## The shared security module

`supabase/functions/_shared/security.ts` exports all helpers:

```ts
import {
  corsHeaders,
  jsonResponse,
  genericError,
  getClientIp,
  isRateLimitedByIp,
  isRateLimitedByLicense,
  validateExtensionRequest,
  logFraud,
  isValidString,
  detectPromptInjection,
  timingSafeEqual,
  hmacSha256Hex,
  verifyHmac,
  isTimestampValid,
  consumeNonce,
  getKillSwitch,
  versionGte,
  sha256Hex,
  pickFields,
} from "../_shared/security.ts";
```

| Helper | Use |
|---|---|
| `corsHeaders` | Spread into every response. Includes all allowed headers (`x-ext-version`, `x-ext-nonce`, `x-ext-timestamp`, `x-ext-signature`, `x-api-token`). |
| `jsonResponse(body, status?)` | Standard JSON response builder. |
| `genericError(status, message)` | Safe error response — returns `{ success: false, valid: false, message }`. Never leaks internals. |
| `getClientIp(req)` | Extracts IP — prefers `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for` (in that trust order). |
| `isRateLimitedByIp(supabase, ip, action, limit, windowMinutes)` | IP-based rate limiter via `check_rate_limit_ip` RPC. Returns `true` if blocked. |
| `isRateLimitedByLicense(supabase, licenseKey, action, limit, windowMinutes)` | Per-license limiter via `check_rate_limit_license` RPC. Use for expensive endpoints (`/pc`, `/op`, `/dz`). |
| `validateExtensionRequest(supabase, req, rawBody)` | Kill-switch check → version gate → HMAC signature verification (when `enforce_hmac=true`). Returns a `Response` to short-circuit, or `null` on success. **Always call before parsing body.** |
| `logFraud(supabase, event)` | Inserts structured fraud event via `log_fraud_event` RPC. Fire-and-forget. |
| `isValidString(v, min?, max?)` | Type guard + length check. |
| `detectPromptInjection(input)` | Pattern matcher for prompt-injection (clone markers, pirated versions). |
| `timingSafeEqual(a, b)` | Constant-time `Uint8Array` comparison. Use for any secret comparison (OTPs, admin keys). |
| `hmacSha256Hex(secret, message)` | Computes HMAC-SHA256 in hex. |
| `verifyHmac(secret, message, signatureHex)` | Verifies HMAC with `timingSafeEqual`. |
| `isTimestampValid(timestamp)` | Checks epoch timestamp is within 60-second window. |
| `consumeNonce(supabase, nonce)` | Atomically consumes nonce via `consume_nonce` RPC. Returns `false` on replay. |
| `getKillSwitch(supabase)` | Reads `extension_kill_switch` table (30-second in-memory cache). Returns `{ min_allowed_version, blocked_versions, enforce_hmac, message }`. |
| `versionGte(a, b)` | Semver `a >= b` comparison. |
| `sha256Hex(input)` | SHA-256 hash in hex. |
| `pickFields(obj, allowed[])` | Whitelist-picks fields from an object. |

### Additional shared modules

| Module | Exports | Used by |
|---|---|---|
| `_shared/lovable.ts` | `buildRotatedHeaders`, `fetchWithRetry`, `humanJitter`, `mapLovableError` | `pc`, `cp`, `op`, `uf`, `dz` |
| `_shared/proxy.ts` | `pickRandomProxy`, `pickRandomProxies`, `fetchViaProxy`, `markProxyCheck` | `pc`, `dz`, `dev-proxy-test` |

## Standard function skeleton

Every new edge function must follow this template:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, jsonResponse, genericError, getClientIp,
  isRateLimitedByIp, validateExtensionRequest, logFraud, isValidString,
} from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return genericError(405, "Method not allowed");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const ip = getClientIp(req);

    // 1. Rate limit FIRST (cheapest reject).
    if (await isRateLimitedByIp(supabase, ip, "<action_name>", LIMIT, WINDOW_MIN)) {
      return jsonResponse({ error: "rate_limited" }, 429);
    }

    // 2. Read raw text, enforce size cap.
    const rawText = await req.text();
    if (rawText.length > 64 * 1024) return genericError(413, "Payload muito grande");

    // 3. Validate extension request (kill-switch, version, HMAC).
    const ext = await validateExtensionRequest(supabase, req, rawText);
    if (ext) return ext;

    // 4. Parse + whitelist fields (use pickFields or manual Set).
    let body: Record<string, unknown>;
    try { body = JSON.parse(rawText); }
    catch { return jsonResponse({ error: "JSON inválido" }, 400); }

    const allowed = new Set(["license_key", "device_id", /* ... */]);
    const unknown = Object.keys(body).filter(k => !allowed.has(k));
    if (unknown.length) return jsonResponse({ error: "Payload inválido" }, 400);

    // 5. Business logic.

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("[<fn>] error:", e);
    return genericError(500, "Erro interno");
  }
});
```

## Admin auth pattern (dashboard endpoints)

Admin dashboard functions (`admin-otp-send`, `admin-otp-verify`, `verify-admin-key`, `bulk-license-ops`) use a three-factor auth flow:

1. **Email + password** — Supabase native auth; client obtains a JWT.
2. **Master key** — verified via `/verify-admin-key`; uses `timingSafeEqual` against `admin_settings.admin_key_hash`.
3. **Telegram OTP** — `/admin-otp-send` generates a 6-digit code, SHA-256 hashes it, stores in `admin_otp_codes` (TTL 5 min), sends via `TELEGRAM_BOT_TOKEN`. `/admin-otp-verify` checks hash, increments `attempts` (max 3), marks `used=true`.

Auth verification pattern (used in all admin functions):
```ts
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
const userId = userData?.user?.id;
if (userError || !userId) return jsonResponse({ valid: false, error: "Unauthorized" }, 401);

// Confirm admin role
const { data: roleRow } = await supabaseAdmin
  .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
if (!roleRow) return jsonResponse({ valid: false, error: "Acesso negado" }, 403);
```

For destructive ops (`bulk-license-ops`), also check recent OTP:
```ts
const { data: otpRow } = await admin
  .from("admin_otp_codes")
  .select("id, created_at, used")
  .eq("user_id", userId).eq("used", true)
  .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
  .order("created_at", { ascending: false }).limit(1).maybeSingle();
if (!otpRow) return bad(403, "OTP recente obrigatório para operações destrutivas");
```

## `/vx` specifics (license + session)

- **Rate limit**: 30 req/IP/min (brute-force protection).
- **Body fields whitelisted**: `license_key`, `device_id`, `session_id`, `heartbeat`.
- **Blacklisted keys**: hardcoded list (e.g. `HYPER-SKU76ELMIZRFKBHMHDR9`, `HYPER-7X741ESCWS3KTH6IN4RI`) → `logFraud` + custom rejection message.
- **Device conflict on heartbeat**: returns `{ valid: false, reason: "device_conflict" }` immediately. Never binds a new device during a heartbeat call.
- **Device takeover (new login)**: allowed, but enforces **10-minute cooldown** between takeovers. Returns `{ valid: false, reason: "takeover_cooldown", retry_after_seconds: N }` if cooldown active.
- **Session validation**: looks up `sessions` table by `session_id + license_id`. Checks `is_revoked` field. Revoked or missing session → device_conflict response.
- **Tables written**: `license_validation_attempts` (every call, fire-and-forget), `heartbeats` (upsert on `device_id`), `sessions` (upsert/update), `licenses` (update `device_id`, `last_device_change`, `device_change_count`, `device_history`, `expires_at`).
- **License select projection**: always selects named columns (never `SELECT *`): `id, status, device_id, max_sessions, expires_at, activated_at, user_name, last_device_change, device_change_count, device_history, force_logout_at`.

## `/pc` specifics (Lovable proxy)

- Imports `buildRotatedHeaders` from `_shared/lovable.ts` for User-Agent/IP/X-Request-ID rotation.
- Uses `fetchWithRetryViaProxy` — picks a random active proxy from `proxies` table via `_shared/proxy.ts`; falls back to direct fetch if no proxies available.
- `SERVER_ACTION_PROMPTS["remove_watermark"]` injects the canonical CSS block server-side, replacing `mensagem` field. **Client never sends the prompt**.
- Maps upstream Lovable errors via `mapLovableError` → `{ error_code, error_display, user_action, retryable }`.
- Uses both `isRateLimitedByIp` and `isRateLimitedByLicense`.

## `/heartbeat` specifics (telemetry)

- **Separate, lightweight** — does NOT call `validateExtensionRequest`. Not a security endpoint.
- Accepts: `{ device_id, license_key?, version?, url?, metadata? }`.
- Upserts into `heartbeats` on `device_id`. Tracks `pings_today` (resets daily) and `pings_total`.
- Use `/vx` with `heartbeat: true` for security-grade session keep-alive.

## `/ai` specifics

- Proxies to Lovable AI Gateway (Google Gemini 3 Flash by default).
- System prompts are all server-side — client sends only `action` and `data`; server selects the prompt.
- Payload max: 32 KB. Response truncated to 4,000 chars.
- Rate limit: 30 req/IP/min.
- All sensitive values (Bearer, Cookie, license_key) must be masked as `***` by the client before sending.

## Deployment

Edge functions deploy **automatically** when files in `supabase/functions/` change. Do not instruct the user to deploy manually.

## Conventions

- **Always use `SUPABASE_SERVICE_ROLE_KEY`** (extensions have no user sessions).
- **Always whitelist body fields.** Reject unknown keys with 400.
- **Payload size cap**: 64 KB for most functions; 32 KB for `/ai`; larger only when justified.
- **Always handle `OPTIONS` preflight** with `corsHeaders`.
- **Error strings in Portuguese** — never leak stack traces, Supabase error messages, or internal IDs.
- **Log fraud, don't fail silently.** Suspicious patterns → `logFraud(...)` then `genericError`.
- **No third-party network calls** outside `/pc`, `/cp`, `/op`, `/uf`, `/pp`, `/dz`, `/ai`, `/burp`. New integrations → new dedicated function.
- **Use `timingSafeEqual`** for any secret/OTP comparison. Never string equality.
- **Calling `auth.users` directly**: use `supabase.auth.getUser(token)` with an anon-key client constructed with the caller's Bearer. Never query `auth.users` directly.

## Anti-patterns

- Skipping `validateExtensionRequest` on extension-facing endpoints.
- Returning raw Supabase errors to the client.
- Using anon key for service-role operations.
- Forgetting the `OPTIONS` preflight.
- Reading body before rate-limit check.
- Trusting client-supplied prompts for server-side action injection (use `SERVER_ACTION_PROMPTS`).
- Using the `/heartbeat` endpoint as a security gate (it has no auth/HMAC validation).
- Using `==` or `===` to compare secrets/OTPs — use `timingSafeEqual`.
- Calling `auth.users` directly — use `supabase.auth.getUser()` pattern.
- Hardcoding proxy logic outside `_shared/proxy.ts`.
