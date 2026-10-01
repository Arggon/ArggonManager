---
type: task
status: done
id: task-update-channel-spec
title: "Spec + plan: bounded opt-out update channel"
assignee: Arggon
branch: feat/task-update-channel-spec
parent: story-update-channel
labels: [delivery, spec]
priority: p1
created: "2026-10-01"
updated: "2026-10-01"
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

### 2026-10-01 @ses_f081ac601ffeuHKWvORtLujr9F
Spec + plan delivered (design only, no cli/src touched).

Artifacts:
- Spec: ArggonManager/docs/specs/spec-update-channel-015.md
- Plan: ArggonManager/docs/plans/plan-update-channel-015.md (T1-T6, linked to spec)
- Baseline: ArggonManager/spec-analyze-baseline.json (pre-change snapshot, committed)

Edge-case disposition (exploration-update-delivery-016, all 15 rows): AC 1 hostile body (parse-guard, no cache write) / AC 2 404+yanked / AC 3 concurrency (tmp+rename, last-wins) / AC 4 offline+2000ms detached abort / AC 5 interval 24h + local-cache-only command path / AC 6 privacy (own-packument GET, no identifiers, README same-PR task) / AC 7 environment matrix (CI=no GET+notice suppressed+JSON present; non-TTY; --json) / AC 8 no credentials / AC 9 cannot-compare (strict semver) / AC 10 timestamps (unparseable/future>5min=expired, ISO-8601 UTC) / AC 11 formatVersion key / AC 12 observability (additive update object both surfaces) — rows lib-skew, publish-creds, workflow-ops are OUT (ADR 0018 §1/§2 pipeline stories).

Gates (worktree, branch feat/task-update-channel-spec):
- arggon spec validate: ok (26 doc(s), 0 warning(s)) — expected clean, observed clean
- arggon spec analyze --baseline ArggonManager/spec-analyze-baseline.json: expected 0 NEW, observed total 6 / unchanged 6 / added [] / resolved [] / failed false, exit 0
- arggon validate --json: expected ok, observed ok:true, 0 errors, 0 warnings
- Scope check: git diff vs main touches only spec-update-channel-015.md, plan-update-channel-015.md, spec-analyze-baseline.json, task-update-channel-spec.md (checklist ticks)

PR: https://github.com/Arggon/ArggonManager/pull/542 (item id in title)

### handoff 2026-10-01 @ses_f081ac601ffeuHKWvORtLujr9F (session: ses_f081ac601ffeuHKWvORtLujr9F) — next: After PR #542 merges: file the implementation task(s) under story-update-channel per plan-update-channel-015.md T1-T6; spec-update-channel-015.md is the contract; flip spec+plan to implemented in the…
- branch: feat/task-update-channel-spec
- open questions: 1) Detached-fetch mechanism (child process vs in-process unref) is bound by the observable contract (cache populated after triggering command exits) - implementer picks; 2) ARGGON_NO_UPDATE_CHECK hon…
