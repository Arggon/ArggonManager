---
type: task
status: in_progress
id: task-update-channel-spec
title: "Spec + plan: bounded opt-out update channel"
assignee: Arggon
branch: feat/task-update-channel-spec
parent: story-update-channel
labels: [delivery, spec]
priority: p1
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T14:37:34.769Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-update-channel-spec
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/update-channel/story-update-channel/task-update-channel-spec.md
  Leaves live only under a story. id is the filename stem: task-update-channel-spec.
  CLI `arggon create task update-channel-spec` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec + plan: bounded opt-out update channel

## Context

Implements the spec-first gate for [ADR 0018](../../../../docs/adr/0018-update-delivery-and-distribution-channel.md)
§3: the bounded, opt-out update check with an agent-first JSON surface.
Acceptance criteria are lifted from the edge-case table in
[exploration-update-delivery-016](../../../../docs/explorations/exploration-update-delivery-016.md)
(all rows typed spec AC / non-goal). ADR-settled semantics: hand-rolled
(~50 lines, no new runtime dependency); interval-gated (24 h default) detached
GET of `registry.npmjs.org/arggon-manager/latest` with ~2 s timeout; atomic
cache (tmp + rename) in the OS temp dir under a format-version key; on CI the
GET never runs and the JSON fields report the cache state (explicit unknown
otherwise).

## Acceptance

- [x] Spec at `ArggonManager/docs/specs/spec-update-channel-NNN.md` (next free number via `arggon spec new update-channel --plan`) + linked plan. Surfaces: additive `update: { latest, current, cachedAt }` on `doctor --json` and `--version --json` (documented in `ArggonManager/docs/json-output.md` — additive only, no `schemaVersion` bump); TTY-only deferred one-line notice with the exact upgrade command.
- [x] Every edge-case row from the exploration table appears as an acceptance criterion (hostile/garbage → no-update never-error; 404 → same; concurrency → atomic cache; offline/timeout → silent no-op ≤ ~2 s; perf → interval + cached, cold runs never wait; privacy → own-packument GET only, documented in README same-PR; environment → `CI` set = no GET, notice suppressed, JSON fields always present; platform → non-semver installed version = "cannot compare", no notice; time → `cachedAt`, unparseable timestamp = expired; persistence → cache format-version key, foreign cache = miss).
- [x] Invariants: the check never blocks, retries, or fails a command; no new runtime dependencies; `ARGGON_NO_UPDATE_CHECK=1` honored (documented in README in the same PR as the implementation — note it in the plan's task list).
- [x] Non-goals: automatic self-update; `whatsnew`; authenticated registry paths; check-on-CI.
- [x] `arggon spec validate` ok; `spec analyze --baseline <file>` no NEW findings (baseline committed); `arggon validate` ok.
- [x] Scope stays design-only: implementation tasks are filed later under `story-update-channel` (this item does not touch `cli/src`).

## Notes
