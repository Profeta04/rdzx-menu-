---
name: hyperbuild-licensing-flow
description: End-to-end licensing flow for HyperBuild — license validation, device binding, device takeover with cooldown, heartbeat, session lifecycle, auto-logout on device conflict, watermark removal authorization, admin OTP auth. Use when touching login, logout, license keys, device IDs, sessions, or any auth-gated extension feature.
---

# HyperBuild Licensing Flow

The extension is gated by a server-validated license. **Never trust the client** for licensing decisions. All authoritative state lives in the `licenses`, `sessions`, and `heartbeats` tables, enforced by `/vx`.

## Identifiers

| ID | Source | Storage key | Lifetime |
|---|---|---|---|
| `license_key` | User-entered in login UI | `ql_license_key` | Persistent until logout/expiry |
| `device_id` | `hwFingerprint.js` (hardware fingerprint, stable per machine) | `ql_device_id` | Persistent per install |
| `session_id` | Server-issued by `/vx` on successful login | `ql_session_id` | Rotates on re-login; invalidated on device conflict |

All three are persisted in `chrome.storage.local`.

## Login flow

1. User enters license key in the floating/sidepanel login UI.
2. Client computes `device_id` via `hwFingerprint.js`.
3. Client POSTs to `/vx`:
   ```json
   { "license_key": "HYPER-...", "device_id": "fp_...", "session_id": null, "heartbeat": false }
   ```
4. Server (`vx/index.ts`) pipeline:
   - Rate-limit by IP (30/min).
   - `validateExtensionRequest` (kill-switch, version gate, HMAC if enforced).
   - Whitelist fields; reject unknown keys.
   - Check hardcoded blacklist → `logFraud` + custom rejection.
   - Look up license by `license_key`.
   - Check `status` (revoked → reject), expiry (expired → update status + reject).
   - Device binding / takeover logic (see below).
   - Issue new `session_id`; upsert into `sessions`.
5. On success: client stores `ql_license_key`, `ql_device_id`, `ql_session_id`; unlocks UI.
6. Every attempt (success or failure) is fire-and-forget inserted into `license_validation_attempts`.

## Heartbeat / re-validation

The extension periodically calls `/vx` with `heartbeat: true` and the existing `session_id`:
```json
{ "license_key": "HYPER-...", "device_id": "fp_...", "session_id": "sess_...", "heartbeat": true }
```

Server behavior on heartbeat:
- Looks up the session row by `session_id + license_id` — checks `is_revoked`. Missing or revoked session → `{ valid: false, reason: "device_conflict" }`.
- Checks device_id — mismatch on a heartbeat → **immediate device_conflict** (no takeover on heartbeat).
- Updates `sessions.last_heartbeat` and `licenses` keep-alive fields.

**Separate telemetry heartbeat** (`/heartbeat` endpoint) — accepts `{ device_id, license_key?, version?, url?, metadata? }` and upserts `heartbeats` table (`pings_today`, `pings_total`). This is **not a security check** and has no HMAC/auth validation. Do not use it as a gate.

## Device conflict → auto-logout

When `/vx` returns `{ valid: false, reason: "device_conflict" }`:

1. Client clears `ql_license_key`, `ql_device_id`, `ql_session_id` from storage.
2. Resets all in-memory licensed state.
3. Returns UI to the login screen.
4. Shows friendly message: "Sua licença foi acessada em outro dispositivo. Você foi desconectado por segurança."

**Do not implement any client-side override.** The server is the sole source of truth.

## Device takeover (new login on different machine)

When a login (`heartbeat: false`) arrives with a `device_id` that differs from the license's current `device_id`:

1. **Cooldown check**: if the license had a device change in the last **10 minutes** (`last_device_change`), the takeover is blocked:
   ```json
   { "valid": false, "reason": "takeover_cooldown", "retry_after_seconds": N,
     "message": "Aguarde Xmin Ys e tente novamente." }
   ```
2. **Takeover allowed**: server atomically updates `device_id`, `last_device_change`, increments `device_change_count`, prepends old device to `device_history` (JSONB array), and revokes all previous sessions (`is_active=false, is_revoked=true`).
3. The previous machine's next heartbeat will receive `device_conflict` and auto-logout.

Handle `reason: "takeover_cooldown"` on the client: show the wait time and disable the login button until `retry_after_seconds` elapses.

## Session fields

Sessions row (`sessions` table):

| Column | Type | Notes |
|---|---|---|
| `session_id` | TEXT | Unique token issued by `/vx` |
| `license_id` | UUID | FK to `licenses` |
| `device_id` | TEXT | Device at session creation |
| `is_active` | BOOL | False = soft-deleted |
| `is_revoked` | BOOL | True = security revocation (device takeover or force-logout) |
| `last_heartbeat` | TIMESTAMPTZ | Updated on each valid heartbeat |

## Logout (manual)

Clear: `ql_license_key`, `ql_device_id`, `ql_session_id` + cached user data (`lovable_token`, `lovable_projectId`, packages, notifications).

**Do NOT clear**: `ql_ui_mode`, `ql_rgb_enabled` (UI prefs persist across sessions).

## Authorization gate (every sensitive action)

Before any call to `/pc`, `/op`, `/cp`, `/uf`, `/pp`, `/dz`, the client must include:

```http
Authorization: Bearer <SUPABASE_ANON_KEY>
apikey: <SUPABASE_ANON_KEY>
x-license-key: <ql_license_key>
x-device-id: <ql_device_id>
```

The server re-validates the license on each call (never assumes "valid at login = always valid"). All these calls go through `proxyFetch` in the extension.

## `/vx` error response shape

All `/vx` responses are HTTP 200 (even failures) with:
```json
{ "valid": true|false, "reason"?: "...", "message": "...", ... }
```

Client must check `valid` field — **not** HTTP status — for licensing decisions.

Known `reason` values:

| reason | Meaning | Client action |
|---|---|---|
| `rate_limited` | Too many attempts | Show cooldown message |
| `not_found` | License key not in DB | Show "key not found" |
| `revoked` | License manually revoked | Show "contact support" |
| `expired` | `expires_at` in the past | Show renewal CTA |
| `device_conflict` | Heartbeat from wrong device | Auto-logout immediately |
| `takeover_cooldown` | Takeover attempted < 10 min after last change | Show `retry_after_seconds` countdown |
| `missing_key` | No license_key sent | Show login form |

## Watermark removal

The "Remover marca d'água" button sends `/pc` with `action: "remove_watermark"`. The server's `SERVER_ACTION_PROMPTS["remove_watermark"]` map injects the canonical CSS block, replacing `mensagem`. **The client never sends the removal prompt** — it is server-managed so it can be updated centrally and cannot be reverse-engineered from the client bundle.

## Admin dashboard auth (three factors)

Admin dashboard is not license-gated — it uses Supabase native auth plus two extra factors:

1. **Email + password** → `supabase.auth.signInWithPassword()` → JWT.
2. **Master key** → POST `/verify-admin-key` with `{ admin_key }` + `Authorization: Bearer <JWT>`.
3. **Telegram OTP** → POST `/admin-otp-send` to trigger a 6-digit code to the admin's Telegram; POST `/admin-otp-verify` with `{ code }` + Bearer JWT.

For destructive operations (bulk-license-ops), the server additionally checks that the OTP was verified within the last **5 minutes**.

## License table key fields

| Column | Notes |
|---|---|
| `license_key` | Unique text key (format `HYPER-XXXX...`) |
| `status` | ENUM: `active`, `trial`, `expired`, `revoked` |
| `device_id` | Currently bound device (null if never activated) |
| `last_device_change` | Timestamp of last device takeover |
| `device_change_count` | Total takeovers performed |
| `device_history` | JSONB array of past `{ device_id, replaced_at }` |
| `force_logout_at` | If set, `/vx` will invalidate all sessions on next call |
| `expires_at` | Null = no expiry; otherwise hard expiry datetime |
| `max_sessions` | Default 1 |
| `user_name` | Display name (returned to client on successful login) |

## Adding a new auth-gated feature

Checklist:

1. **Server**: create or extend an edge function following `hyperbuild-edge-functions` template. Validate license inside the function (query `licenses` table; check `status === "active"` and `expires_at`).
2. **Server**: add `isRateLimitedByLicense` if the action is expensive.
3. **Client**: gate the UI element behind a `qlLicenseKey` truthiness check.
4. **Client**: route the request through `proxyFetch` with the four headers above.
5. **Client**: handle all `reason` values — especially `device_conflict` (auto-logout) and `expired` (renewal CTA).
6. **Backward compat**: older extension versions must keep working unless explicitly bumped — default response shape stays the same; add new fields additively.

## Anti-patterns

- Using a cached `isLicensed` boolean in client memory as the sole gate.
- Reading `ql_license_key` from storage and calling Lovable directly (bypassing `/pc`).
- Hardcoding license keys for testing in committed code.
- Telling the user "client says you're logged in" instead of re-checking with `/vx`.
- Adding a "remember device override" toggle for the device-conflict case.
- Treating HTTP status as the auth result — always check `valid` field.
- Using `/heartbeat` endpoint as a session validator (it has no auth).
- Attempting device takeover without handling the `takeover_cooldown` response.
