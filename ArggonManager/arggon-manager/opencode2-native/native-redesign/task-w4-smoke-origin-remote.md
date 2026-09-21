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

- [x] The permissions fixture plants an `origin` remote (or the check is rewritten) so the reviewer shell gate is actually exercised and the denial is asserted deterministically.
- [x] `npm run smoke:opencode` stable across repeated runs.
- [x] `arggon validate` green; CI green.

## Notes

- Filed per the review-findings rule; W6/W7 territory (smoke stability).

### 2026-09-21 @Arggon
<<<<<<< HEAD
### Verdict: MERGE — PR #385 `feat/task-w4-smoke-origin-remote` @ b08afbd (base `opencode2`, draft)

Reviewer: DeepSeek V4.1 Flash (review session ses_f39a6b85bffe8EK356848vxrlR). Scope audited: `smoke/opencode-smoke.ts` (+197/−49), `smoke/opencode-smoke.test.ts` (new, 13 tests), one playbook line, item comments — 4 files, no parallel-worker files touched (`docs/json-output.md`, `skills/`, `start.ts`, `lib/README` clean).

Recommendation: **merge with a merge commit (never squash)**. No blocking findings. Item stays `in_progress` — not marking it done.

#### Verified independently (real runs, opencode v2.0.12, model opencode-go/deepseek-v4-flash)

1. **The fixture really forces the push and the denial is real.** I re-ran the W4 group twice on b08afbd: `OPENCODE_SMOKE_ONLY=w4 npm run smoke:opencode` → 3 scenarios / 0 failures both times (run 1 with `ARGON_SMOKE_KEEP=1` to keep the transcript; run 2 without it, and `dispose()` removed both the fixture and the sibling bare remote — no leftovers).
2. **Raw-transcript audit, independent of the harness asserts** (`/tmp/arggon-smoke-permissions-Yuvfml/.smoke-evidence/permissions.stdout.jsonl`):
   - `git push origin main` → `part.state.status="error"`, `part.state.error="Permission denied: shell"`, no output. That is exactly the shape `shellDenied()` now reads; the old helper read `state.output`, so it could never match (root cause 2 confirmed).
   - An earlier shell call in the same session shows `origin /tmp/arggon-smoke-permissions-Yuvfml-remote.git` and `Your branch is up to date with 'origin/main'` — the probe push is a valid no-op command, so the gate (not a missing remote/branch) is what denies it.
   - The same session's `search({ namespace: "arggon", limit: 20 })` returns exactly 6 items (`tools.arggon.comment/list/next/report/show/validate`) with `remaining: 0`; the default-agent scenario asserts 15 and both are green, so the 9 mutating tools are absent by the runtime's permission filtering — not by a model decision.
3. **No tautology / no narrative fallback.** `textContains(session.stdout, "Permission denied")` is gone from the push check; only a real refused shell call matches (status `error` + command contains the needle + `Permission denied` in error/output). Unit test “never matches on the model narrative alone” pins this. If a session never attempts the push, `reviewerProbe` retries once and the final `shellDenied` check fails loudly — no silent green.
4. **No false positive.** `main` is pushed to the planted origin before the probe, so a gate regression that allowed the push would complete it (`Everything up-to-date`) and the denial check fails on the completed call.
5. **Deterministic gates:** `npx vitest run smoke/opencode-smoke.test.ts` → 13/13; `npm run lint` → green; `arggon validate` and `arggon spec validate` → ok, no errors/warnings (worktree).
6. **CI on the exact head** (b08afbd88fb6ca612396c091c4bf64e661d353c9, matches my local HEAD): `cli` pass (build + check:plugin + test + lint) and `tasks-validate` pass. After 72f7c37 the branch only adds item comments, so the worker's post-commit W4 confirmation covers the reviewed code bytes.
7. **Scope:** only the 4 files above; no parallel-worker files.

#### Not independently reproduced (disclosed)

- The full 26-scenario `npm run smoke:opencode`: worker evidence 2/2 green (966 s, 747 s) + 4 W4 runs. I reproduced the W4 group twice and audited the deterministic logic plus the raw transcript instead of repeating the long run.
- Local full suite on this shared machine: **1469/1470** passed; the only failure was `cli/src/measure.test.ts > always deletes the measurement temp tree (/tmp hygiene)` (leftover `/tmp/arggon-budget-DT4snm`, which vanished right after — created/deleted by a parallel session running its own suite). That test scans global `${TMPDIR:-/tmp}` and is cross-suite sensitive; it passes in isolation (11/11) and CI ran the full `npm run test` green on b08afbd. Environmental, not PR-related. A repeat with an isolated TMPDIR is running; result will be appended.

#### Non-blocking observations

- Documented residual limit: the shell probe still needs the model to issue the command (planted origin + explicit prompt + one bounded retry); a session that never attempts it fails the scenario instead of passing silently. That satisfies the acceptance criterion (deterministic assertion over a real denial).
- `shellDenied` matches `/Permission denied/` anywhere in `state.error`/`state.output`; could be tightened to the exact `Permission denied: shell` gate text if a future runtime changes shape. Not a defect today (a local-path remote cannot yield that string from git itself).
- The `leaked` check duplicates part of the exact-set catalog assertion (only improves the failure message). Harmless.

Change requests: none.
=======
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
>>>>>>> feat/task-w4-smoke-origin-remote

### 2026-09-21 @Arggon
Coordinator note: reviewer session could not post (its background suite kept ending turns), so the coordinator verified the diff (plantOrigin bare repo + push main so the reviewer can attempt the push; deterministic catalog/permission asserts via shellDenied on the 2.0.12 message; 13 new unit tests) against the strong evidence: two full harness runs 26/0 (966s, 747s), 1470 tests, lint/build/check:plugin/validate/spec, CI pass. Merged with merge commit; item flipped to done.
