---
type: bug
status: in_progress
id: bug-start-overwrites-board-assignee
title: start overwrites board role assignee with shared git login
assignee: Arggon
branch: fix/start-preserve-assignee
parent: story-claim-leases
labels: [cli, claim]
priority: p1
created: "2026-11-03"
updated: "2026-11-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-claim-leases/bug-start-overwrites-board-assignee.md
  Leaves live only under a story. id is the filename stem: bug-start-overwrites-board-assignee.
  CLI `arggon create bug start-overwrites-board-assignee` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# start overwrites board role assignee with shared git login

## Context

`arggon start` (CLI and the OpenCode native `tools.arggon.start`) defaulted the claim assignee to `resolveCurrentLogin()` / `kernel.resolveCurrentLogin()` whenever the caller omitted `--assignee` / `input.assignee`. That login comes from `GITHUB_USER` / `GITHUB_ACTOR` / `gh` / git config. In multi-bot adopters (notably ArggonStores) every agent commits as the shared GitHub user `Arggon`, so claiming a leaf that already carried a board **role** assignee (`Engineer`, `PM`, …) rewrote `assignee: Arggon` on every start.

Observed on ArggonStores board PRs [#1142](https://github.com/Arggon/ArggonStores/pull/1142) and [#1149](https://github.com/Arggon/ArggonStores/pull/1149) (Reviewer lows; #1142 assignee was restored in #1144). Vendored native path patched in ArggonStores [#1152](https://github.com/Arggon/ArggonStores/pull/1152); this item is the upstream source fix.

Pre-fix (main): `cli/src/start.ts` used `opts.assignee ?? resolveCurrentLogin()` and ignored `item.assignee`; `opencode/plugins/arggon/index.ts` `nativeStart` mirrored that with `input.assignee ?? kernel.resolveCurrentLogin()`.

## Acceptance

- [x] Start resolution order is explicit assignee → existing item assignee → login, on both the CLI and the native OpenCode tool (and the generated bundle stays in sync)
- [x] CLI tests cover keep / override / login-fallback
- [x] Native/plugin tests cover the same three branches (so a plugin-only edit cannot regress silently)
- [ ] `arggon validate` green; CI green on the fix PR; Reviewer re-review

## Notes

`claimed_at` and `branch` remain written by design on start (soft lease / branch bookkeeping). Board-only status flips that must not touch `branch` can keep using `arggon update --status in_progress` (already preserves assignee).
