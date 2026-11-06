---
name: hyperbuild-release-packager
description: Release workflow for the Hyper RB extension — bump manifest version in public/burp_src/, generate the user-facing ZIP from public/burp_src/, deliver via presentation-artifact, and verify the Chrome Web Store package. Use when the user asks to release, build, package, publish, ship, or compile a new extension version.
---

# HyperBuild Release Packager

This skill captures the deterministic release procedure for **Hyper RB** (the Chrome extension). Follow it exactly so the manifest, the ZIP archive, and the admin Build tab stay in sync.

> **Architecture note (v4.0.7):**  
> - **Extension source of truth:** `public/burp_src/` — all `burp_*` JS/CSS/HTML files + `manifest.json` + `scripts/` subdirectory.  
> - **There is no separate `extension/` folder** for this extension. The `public/burp_src/` dir IS the source.  
> - ZIPs are stored in `public/` and named `hyper-rb-v<version>.zip`.

## Inputs you need

1. The new semver version (ask the user if not provided; default to patch bump from `public/burp_src/manifest.json`).
2. Confirmation that all edits in `public/burp_src/` are complete and tested.
3. Whether the user wants the ZIP delivered in chat (`/mnt/documents/`) or saved to `public/` for admin Build tab downloads.

## Pre-release checklist (run before anything else)

- [ ] `eslint` clean on changed files (run `npm run lint`).
- [ ] Smoke test: load `public/burp_src/` as unpacked extension in `chrome://extensions`, open lovable.dev, confirm sidebar opens and network capture works.
- [ ] `manifest.json` `"version"` field reflects the new release (not the current `4.0.7` unless bumping to `4.0.8`).
- [ ] `web_accessible_resources` entries cover all new scripts (especially any new `scripts/*.js` added to `public/burp_src/scripts/`).
- [ ] `host_permissions` still matches required domains (currently: `lovable.dev`, `*.lovable.dev`, `api.lovable.dev`, `cvbgrjauqjawrsyknhyj.supabase.co`).
- [ ] No debug `console.log` blocks left in `burp_ai_client.js`, `burp_background.js`, or `burp_content.js`.
- [ ] `burp_ai_client.js` still masks Bearer/Cookie/license_key in payload before sending to `/ai`.

## Step 1 — Bump manifest version

Edit **only**:

```
public/burp_src/manifest.json  →  "version": "<new>"
```

Example (4.0.7 → 4.0.8):
```json
{
  "manifest_version": 3,
  "name": "Hyper RB",
  "version": "4.0.8",
  ...
}
```

There is no second manifest file to sync. `public/burp_src/manifest.json` is the single source of truth.

## Step 2 — Verify `web_accessible_resources`

After any new script file is added to `public/burp_src/scripts/`, confirm it is listed in `manifest.json`:

```json
"web_accessible_resources": [{
  "resources": [
    "burp_pageHook.js",
    "burp_sidepanel.html",
    "burp_sidepanel.css",
    "burp_sidepanel.js",
    "burp_chains.js",
    "burp_ai_client.js",
    "scripts/_shared.js",
    "scripts/_registry.js",
    "scripts/*.js"
  ],
  "matches": ["https://lovable.dev/*", "https://*.lovable.dev/*"]
}]
```

The `scripts/*.js` wildcard covers all files in `scripts/`, but individual named entries above it act as documentation. Keep both.

## Step 3 — Generate the ZIP

`zip` is not in PATH. Use `nix`:

**Chat-delivery ZIP** (user downloads from chat):
```bash
rm -f /mnt/documents/hyper-rb-v<version>.zip && \
  cd /dev-server/public/burp_src && \
  nix run nixpkgs#zip -- -r /mnt/documents/hyper-rb-v<version>.zip .
```

**Public download ZIP** (served by admin Build tab, saved to `public/`):
```bash
rm -f /dev-server/public/hyper-rb-v<version>.zip && \
  cd /dev-server/public/burp_src && \
  nix run nixpkgs#zip -- -r /dev-server/public/hyper-rb-v<version>.zip .
```

Zip from `/dev-server/public/burp_src/` always. The end user unpacks this and uses "Load unpacked" in `chrome://extensions`. Zipping from the wrong directory creates a leading-path ZIP that breaks "Load unpacked".

## Step 4 — Verify the ZIP

```bash
ls -lh /mnt/documents/hyper-rb-v<version>.zip
nix run nixpkgs#zip -- -sf /mnt/documents/hyper-rb-v<version>.zip | head -30
```

Expected size: **~100–250 KB** (includes scripts/ directory with many tool scripts).

Anomalies:
- < 30 KB → missing files; check you zipped from `public/burp_src/`, not a subdirectory.
- > 1 MB → accidentally included something large; check for stray `.zip` or media files in `burp_src/`.
- `manifest.json` missing from zip listing → fatal; do not release.

## Step 5 — Deliver via presentation-artifact

Always emit the artifact tag so the user can download from chat:

```
<presentation-artifact path="hyper-rb-v<version>.zip" mime_type="application/zip"></presentation-artifact>
```

The `path` is relative to `/mnt/documents/`. Mime type is `application/zip` (not `application/x-zip-compressed`).

## Step 6 — Chrome Web Store submission notes

When the user asks to publish to the Chrome Web Store (not just generate the ZIP):

1. The ZIP submitted to CWS must come from `public/burp_src/` (same ZIP as above).
2. **Manifest v3 required** — already set (`"manifest_version": 3`). ✓
3. **Permissions audit:** Current permissions are `storage, activeTab, windows, alarms, tabs`. Removing any permission requires a justification note; adding any permission triggers CWS review delay.
4. **host_permissions:** Adding a new host (e.g., a new API domain) also triggers review.
5. **Privacy policy:** Required by CWS if extension handles any user data (it does — license keys, session tokens).
6. **Store listing assets:** 128×128 icon, 1280×800 or 640×400 screenshot(s), short description ≤132 chars.
7. **CWS review time:** 1–3 business days for standard updates; up to 7+ for permission changes.

## Backward compatibility check (mandatory before release)

Before releasing, confirm Hyper RB users on the **previous version** (v4.0.x) still work with current server behavior:

1. Are any client→server payload fields **removed** or **renamed** in `burp_content.js`, `burp_background.js`? If yes, the edge functions (`/vx`, `/heartbeat`, `/pc`, `/ai`) must accept both old and new fields.
2. Does any edge function now **require** a new field that old clients don't send? Gate by `x-ext-version` header or keep old branch.
3. Are any new server responses **breaking** the old client parser? (Old clients may crash on unexpected JSON keys.)
4. Does `burp_ai_client.js` still correctly mask sensitive headers before forwarding to `/ai`?

If any answer is "yes", call it out to the user before publishing.

## File reference

| Path | Role |
|---|---|
| `public/burp_src/` | **Single source of truth** — edit here, zip from here. |
| `public/burp_src/manifest.json` | Manifest MV3 — version bump goes here. |
| `public/burp_src/scripts/` | Extension tool scripts (24+ files) — covered by `scripts/*.js` wildcard in manifest. |
| `public/hyper-rb-v<version>.zip` | Public download served by admin Build tab. |
| `/mnt/documents/hyper-rb-v<version>.zip` | Chat-delivered ZIP (user downloads from Lovable chat). |
| `public/extension.zip` | Generic alias — update to latest after each release if used by Build tab. |

## Anti-patterns

- Editing a non-existent `extension/` folder — **this path does not exist**; source is `public/burp_src/`.
- Referencing `public/ext_build_v62/` — **this path does not exist** in Hyper RB; that was a previous product layout.
- Zipping from project root (`/dev-server`) — produces ZIP with `public/burp_src/` path prefix that breaks "Load unpacked".
- Zipping from `public/` instead of `public/burp_src/` — same problem, plus includes all other ZIPs.
- Forgetting the `<presentation-artifact>` tag — user has no way to download from chat.
- Using `HyperBuild-Pro-v*.zip` naming for Hyper RB releases — those ZIPs in `public/` are a legacy product. Use `hyper-rb-v<version>.zip`.
- Releasing without running the pre-release checklist (P0 lint + smoke test).
- Releasing without the backward compatibility check against the deployed version.

## Changelog template

Add a brief entry to the release response (not a file — just in the chat summary):

```
## Hyper RB v<version> — <date>
- [fix/feat/perf] <description>
- [fix/feat/perf] <description>
ZIP: hyper-rb-v<version>.zip (~XXX KB)
```
