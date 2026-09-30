---
type: task
status: in_progress
id: task-board-serve-hardening
title: "board --serve hardening: origin checks, favicon, optional --open"
assignee: Arggon
branch: feat/task-board-serve-hardening
parent: ui-web-board-v2
labels: [viewer, board, security, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T18:28:51.586Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-serve-hardening
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-serve-hardening.md
  Leaves live only under a story. id is the filename stem: task-board-serve-hardening.
  CLI `arggon create task board-serve-hardening` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# board --serve hardening: origin checks, favicon, optional --open

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The mutating route `POST /api/update` (`cli/src/board-serve.ts`) accepts any request that reaches the loopback port: no Origin/Host/Sec-Fetch-Site validation. JSON content-type does trigger a CORS preflight for cross-origin fetch, but defense in depth is cheap for a local service and keeps the security dimension of the review bar explicit. The page also 404s `/favicon.ico` (only console error in the 2026-09-22 drive), and there is no way to open the browser after `--serve`.

## Acceptance

- [x] Mutating routes validate Origin/Host (loopback only) and reject cross-site requests with 403; the accepted-request contract is documented
- [x] A minimal favicon is served (or an explicit empty response) so the console stays clean; static output unaffected
- [x] Optional `--open` launches the default browser after listen (best-effort, documented)
- [x] Tests cover the rejection paths; README + docs updated

### 2026-09-30 @Arggon
Verdict (PR #491)

**Origin gate.** `POST /api/update` now runs `isAllowedMutatingOrigin` before the kernel write path: `Host` must be the served loopback host with the served port (`127.0.0.1:<port>` / `localhost:<port>` / `[::1]:<port>`); `Sec-Fetch-Site: cross-site` is refused; and when the client sends an `Origin` it must parse to that same loopback origin (http scheme, same port — the literal `null` origin and DNS names that merely resolve to 127.0.0.1 are refused). Everything else answers `403` with the standard JSON error shape ('cross-site update refused (this server mutates for loopback clients only)'). Non-browser clients (curl, scripts) send no Origin/Sec-Fetch-Site and are held to the Host check only — the existing tests and workflows keep working. The accepted-request contract is documented in `ArggonManager/docs/json-output.md` (board section) and the module docblock.

**Favicon.** `GET /favicon.ico` serves a minimal 16x16 SVG kanban glyph (`FAVICON_SVG`, 200 image/svg+xml, Cache-Control 1h) and the served page links it via a serve-only `<link rel="icon">` injection. The static export has neither — byte-identical, asserted. Live evidence: browser console error array is EMPTY after a page load (previously the favicon 404 was the only console error).

**--open.** `arggon board --serve --open` launches the default browser after listen via `openInBrowser` (xdg-open/open/cmd start per platform, detached, spawn errors swallowed — best-effort, the server keeps serving). `--open` without `--serve` is refused ('--open requires --serve (the static export has nothing to open)'); `--serve --open --json` emits the standard envelope plus additive `open: true`.

**Tests + evidence.** board-serve.test.ts: a 14-case unit table for the gate (loopback accept, port mismatch, foreign/DNS-host, foreign scheme, null/garbage Origin, Sec-Fetch-Site matrix), route-level 403 matrix via `http.request` (foreign Origin, null Origin, cross-site, foreign Host — each asserted to NOT reach the kernel: the item on disk is unchanged) + route-level accepts (browser-shaped and script-shaped requests), favicon route/link/static-export assertions, and opener dispatch (linux/darwin/win32) + best-effort throw swallowing. Live drive: `curl` — foreign Origin 403, null Origin 403, Host-gated plain POST reaches the kernel (kernel rule 400, not gate 403); favicon 200 image/svg+xml; page `<link rel="icon">` present; Playwright console error count 0; CLI `--open` refusal message and `--serve --open --json` envelope with `open: true`.

**Gates (after merging origin/main a0e79a49 — PR #483 merged):** npm test 1848 passed / 108 files; lint clean; build green; check:plugin green; arggon validate ok; npx playwright test --grep @smoke 20 passed, zero exclusions.

### handoff 2026-09-30 @Arggon — next: PR #491 ready for review/merge; item stays in_progress until the coordinator flips it after merge
- branch: feat/task-board-serve-hardening
