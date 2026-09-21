---
type: task
status: in_progress
id: task-w4-smoke-origin-remote
title: "W4 smoke: reviewer shell gate never exercised (no origin remote)"
assignee: Arggon
branch: feat/task-w4-smoke-origin-remote
parent: native-redesign
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-21"
claimed_at: "2026-09-21T22:12:54.341Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-w4-smoke-origin-remote
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-w4-smoke-origin-remote.md
  Leaves live only under a story. id is the filename stem: task-w4-smoke-origin-remote.
  CLI `arggon create task w4-smoke-origin-remote` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# W4 smoke: reviewer shell gate never exercised (no origin remote)

## Context

From the W5 full `smoke:opencode` run (2026-09-21): the W4 check "the reviewer's
shell gate denies git push" fails intermittently because the reviewer declines
to run `git push origin main` in a fixture with **no origin remote**, so no
permission denial is emitted. Two independent runs showed the same shape
(transcripts in `/tmp/arggon-smoke-permissions-*`). Pre-existing, not a W5
regression.

Extended (W5 review-fix run, 2026-09-21): the full `smoke:opencode` also failed
`arggon.update` and `arggon.start/cleanup` in the same W4 permissions scenario
because the reviewer ran a reduced script (only `show`) and declined the push,
so the expected `Unknown tool`/`Permission denied` texts never appeared; an
immediate `OPENCODE_SMOKE_ONLY=w4` rerun was 40/0. Same class: the fixture does
not force the actions the checks assert.

## Acceptance

- [ ] The permissions fixture plants an `origin` remote (or the check is rewritten) so the reviewer shell gate is actually exercised and the denial is asserted deterministically.
- [ ] `npm run smoke:opencode` stable across repeated runs.
- [ ] `arggon validate` green; CI green.

## Notes

- Filed per the review-findings rule; W6/W7 territory (smoke stability).

### 2026-09-21 @Arggon
Evidence (branch feat/task-w4-smoke-origin-remote, PR #385)

Root causes (all three made the W4 check pass/fail for reasons unrelated to the gates):
1. The permissions fixture had no `origin` remote and a `master` default branch (`git init -q`), so `git push origin main` was meaningless and the reviewer declined to run it.
2. shellDenied() read the denial from `state.output`, but opencode 2.0.12 records gate refusals in `state.error` ("Permission denied: shell") with no output — the helper could never match; the check only passed through a model-narrative fallback (textContains "Permission denied").
3. The arggon.update/start/cleanup denials required the model to attempt deliberately hidden tools inside the script; a reduced script (observed: `show` only) failed them.

Fix (smoke/opencode-smoke.ts):
- Fixture: `bootstrap()` pins `-b main`; `plantOrigin()` creates a local bare `origin` (`<fixture>-remote.git`); the scenario pushes `main` before the probe so `git push origin main` is a valid up-to-date command; `dispose()` removes both dirs.
- Catalog-layer assertion: the reviewer script returns `{ out, catalog }` with `search({ namespace: "arggon", limit: 20 })`; the check asserts exactly the six allowed tools (comment/list/next/report/show/validate), `remaining: 0`, and no mutating tool present — no model attempt needed.
- shellDenied() reads `state.error` (`state.output` kept as legacy fallback); the model-narrative fallback is gone.
- One bounded retry when a reviewer probe is missing evidence (the probe is read-only, so re-running is safe).
- `main()` behind an `isDirectRun()` guard; transcript parsers exported for unit tests.
- Docs: playbook line updated to the catalog-level evidence.

Tests/gates:
- `npm test`: 90 files / 1470 tests green (new `smoke/opencode-smoke.test.ts`: 13 tests — refusal shapes, shellAttempted/Completed, executeJson, namespace normalization, reviewer catalog partition of the fifteen native tools).
- `npm run lint`, `npm run build` (plugin bundle byte-identical), `arggon validate`, `arggon spec validate`: green.
- `OPENCODE_SMOKE_ONLY=w4 npm run smoke:opencode`: 3 scenarios / 0 failures, 3 consecutive runs (86s, 74s, and the first post-fix run).
- `npm run smoke:opencode` (full, opencode 2.0.12): 26 scenarios / 0 failures, 966s (run 1). Run 2 was still executing while the deterministic gates ran; its result will be added in a follow-up comment.

Remaining limit (documented in the scenario docstring): the shell probe still needs the model to issue the command; the planted origin + explicit instruction + one bounded retry keep it deterministic in practice, and a session that never attempts it fails loudly instead of passing silently.

### 2026-09-21 @Arggon
Run 2 result (follow-up to the evidence comment): `npm run smoke:opencode` — 26 scenarios / 0 failures, 747s, exit 0 (opencode 2.0.12). It ran concurrently with `npm test`/`npm run lint`/`npm run build` in the middle of the command group and still passed.

Post-commit confirmation on the exact committed bytes (72f7c37): `OPENCODE_SMOKE_ONLY=w4 npm run smoke:opencode` — 3 scenarios / 0 failures.

Stability evidence total: full harness 2/2 green (966s, 747s), W4 group 4/4 green.

### handoff 2026-09-21 @Arggon — next: Review PR #385 (draft, base opencode2), confirm CI green, merge with a merge commit (branch carries chore(tasks) auto-commits), then flip the item done.
- branch: feat/task-w4-smoke-origin-remote
- open questions: CI lacks opencode, so smoke:opencode is a local gate (2 full runs + 4 W4 runs green on 2.0.12); playbook pins 2.0.10 — re-probe on runtime bumps.

### 2026-09-21 @Arggon
CI on PR #385: cli pass (4m4s), tasks-validate pass (35s). Acceptance verified: (1) fixture plants a real origin + catalog-level denial assertions; (2) smoke stable — full harness 2/2 (966s, 747s) + W4 4/4; (3) validate/spec validate green and CI green. Checklist left for the coordinator's completion call.
