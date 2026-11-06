---
name: hyperbuild-extension-architect
description: Architecture guide for the Hyper RB Chrome Extension v4.0.7 (MV3). Use when editing burp_src/ files (burp_content.js, burp_sidepanel.js, burp_background.js, manifest.json, burp_floating.css), adding UI features, debugging capture modes, or wiring messages between scripts.
---

# HyperBuild Extension Architect — Hyper RB v4.0.7 (MV3)

Hyper RB is a Chrome MV3 extension that injects a floating interceptor UI into `lovable.dev` to capture HTTP/WebSocket traffic, replay requests (Burp-style), and manage presets for licensed users.

## Source of truth

**Always edit `public/burp_src/`.** The folder `public/ext_build_*/` is the packaged build — never edit it by hand. The release-packager skill handles syncing.

## File map (burp_src/)

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest. Version **4.0.7**. Bump on every user-facing change. |
| `burp_background.js` | Service worker. Owns SW keepalive alarm (~24 s), port-broadcast to sidepanel, `DEDUP_MAP` (O(1), capped 2000), multi-project auth tracking, `getPublicState()`, `proxyFetch`. |
| `burp_content.js` | Injected at `document_start` into lovable.dev. Injects `burp_pageHook.js`, forwards page messages to SW with per-type rate limiting. Top-frame only for hook injection + auth capture. |
| `burp_floating.js` | Floating overlay UI (in-page). Toggled via `BURP_TOGGLE_FLOATING`. |
| `burp_sidepanel.js` | Side-panel UI. Loads presets from `burp_presets` Supabase table at runtime. |
| `burp_sidepanel.html/css` | Sidepanel shell + styles. |
| `burp_floating.css` | Injected floating-mode styles. |
| `burp_pageHook.js` | Injected into the page MAIN world (web_accessible_resources). Patches `fetch`/XHR, reads `localStorage` for auth tokens, detects project/workspace IDs. **Top-frame only — guard at top of file.** |
| `burp_chains.js` | Composer sequence mode helpers (imported via `importScripts`). |
| `burp_ai_client.js` | AI client (Fase 2, `importScripts`). |

## Storage keys (`chrome.storage.local`)

Keys use `burp_` prefix:

| Key | Purpose |
|---|---|
| `burp_device_id` | Hardware fingerprint. |
| `burp_license_key` | User's license. |
| `burp_session_id` | Server-issued session token. |
| `burp_background_state` | Persisted SW state snapshot (network buffer, auth, projects, startupLogs). |

When adding new storage, prefix with `burp_` and include in the cleanup/logout flow.

## Critical patterns (lessons from v4.x)

### 1. asArray() normalization on state restore
Persisted state may be corrupted or missing. Always validate arrays on restore:
```js
state.network = Array.isArray(saved.network) ? saved.network.slice(0, MAX_NETWORK_ENTRIES) : [];
state.startupLogs = Array.isArray(saved.startupLogs) ? saved.startupLogs.slice(0, MAX_STARTUP_LOGS) : [];
```
Never assume a persisted field retains its type between SW restarts.

### 2. `getPublicState()` — networkForUi must always be an array
```js
function getPublicState() {
  const networkForUi = Array.isArray(state.network)
    ? state.network.slice(0, 500).map(stripBody)  // strip requestBody/responseBody for UI
    : [];
  return { network: networkForUi, auth: { hasBearerToken: Boolean(state.auth.bearerToken), ... }, ... };
}
```
`stripBody` removes `requestBody`/`responseBody` before sending to sidepanel — keeps broadcast payload small.

### 3. Per-type RATE_LIMITS in burp_content.js
The message forwarder uses **per-type** limits (not a single global):
```js
const RATE_LIMITS = {
  HOOK_READY: 10,
  AUTH_SNAPSHOT: 20,
  REQUEST_COMPLETED: 600,
  REQUEST_FAILED: 200,
  WS_FRAME: 2000,
};
// Per 5-second window. Log once at limit+1, then silently drop.
```
Do not collapse these into one number — WS_FRAME legitimately fires at high frequency.

### 4. pageHook injection order
`burp_pageHook.js` must be injected **before** any auth-capture attempt:
```js
if (window === window.top) {
  injectHook();                                     // 1st: inject pageHook into MAIN world
  send("BURP_HOOK_READY", { href: location.href }); // 2nd: notify SW
  // auth snapshot triggered at 500 ms + 2000 ms (two attempts)
}
```
Never reverse the order. Never run hook injection inside iframes — the top-frame guard is defense-in-depth.

### 5. fast_mode
Presets and replay requests support a `fast_mode: boolean` field (default `true`) forwarded to the `/pc` edge function. Include it in the body when constructing Burp replay requests from the sidepanel.

## Network: always via SW `proxyFetch`

Content scripts and sidepanel **must not call `fetch()` directly** for cross-origin requests — CORS blocks them. Use:
```js
chrome.runtime.sendMessage({
  type: "BURP_PROXY_FETCH",
  url: "https://...",
  method: "POST",
  headers: { ... },
  body: JSON.stringify(...)
}, (res) => { /* res = { ok, status, data } */ });
```

## Message types (SW ↔ content ↔ sidepanel)

All message types are SCREAMING_SNAKE_CASE strings:

| Type | Direction | Meaning |
|---|---|---|
| `BURP_HOOK_READY` | content → SW | Page hook injected; includes `href`. |
| `BURP_CAPTURE_AUTH` | content → SW | New auth snapshot from pageHook. |
| `BURP_NETWORK_EVENT` | content → SW | HTTP request completed or failed. |
| `BURP_WS_FRAME` | content → SW | WebSocket frame captured. |
| `BURP_TOGGLE_FLOATING` | SW → content | Toggle the floating overlay. |
| `BURP_REQUEST_AUTH_REFRESH` | SW → content | Request fresh auth snapshot (TTL expired). |
| `BURP_STATE_READY` | SW → sidepanel (port) | Initial state broadcast on connect. |
| `BURP_NETWORK_UPDATED` | SW → sidepanel (port) | Network buffer changed. |
| `BURP_AUTH_UPDATED` | SW → sidepanel (port) | Auth state changed. |
| `BURP_LOG_UPDATED` | SW → sidepanel (port) | Startup log updated. |
| `BURP_PROXY_FETCH` | sidepanel → SW | Network proxy request. |

Sidepanel connects via `chrome.runtime.connect()` — SW uses `connectedPorts` set + `port.postMessage()` for broadcasts. This is more reliable than `runtime.sendMessage` when the panel is open.

## SW keepalive

MV3 service workers are killed after ~30 s of inactivity. Hyper RB uses `chrome.alarms` (period `0.4 min` ≈ 24 s) to keep the SW alive. The alarm also triggers `checkAuthTtlAndRefresh()` and `scheduleWsFramesPersist()`. Do not remove the alarm.

## SUPABASE_URL duplication (known debt)

`SUPABASE_URL` is hardcoded in both `burp_background.js` (line 7) and `burp_sidepanel.js` (line ~14). SW uses `importScripts` and sidepanel uses classic `<script>` — they cannot share an ES module without a bundler. **Keep them in sync manually** when the project URL changes. Tracked as `AF-E-C-04`.

## Versioning rule

Every user-visible behavior change bumps `manifest.json` `version` (semver patch for fixes, minor for features). `public/ext_build_*/manifest.json` only updates when release-packager runs.

## When debugging

1. `chrome://extensions` → reload unpacked after every file change.
2. SW logs: click **service worker** link on the extension card.
3. Content script logs: DevTools on `lovable.dev`.
4. Sidepanel logs: right-click inside panel → Inspect.

## Anti-patterns (do not do)

- `fetch()` to lovable.dev or third-party directly from `burp_content.js` / `burp_sidepanel.js`.
- Validating license only on the client.
- Running `injectHook()` inside an iframe or after the auth snapshot trigger.
- Assuming `state.network` is an array after SW restart without `Array.isArray()` check.
- A single global rate limit for all postMessage types — use per-type `RATE_LIMITS`.
- Editing files under `public/ext_build_*/` directly.
- Hardcoding `fast_mode: false` — default must be `true`.
