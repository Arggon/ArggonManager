---
type: task
status: done
id: task-opencode2-orchestration-hardening
title: "Wave harness hardening: probe marker assertions, batching checks, A/B export guard"
assignee: Arggon
branch: feat/task-opencode2-orchestration-hardening
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-orchestration-hardening
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode2-orchestration-hardening.md
  Leaves live only under a story. id is the filename stem: task-opencode2-orchestration-hardening.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Wave harness hardening: probe marker assertions, batching checks, A/B export guard

## Context

Non-blocking findings from the independent review of PR #330
(`task-opencode2-orchestration`), filed per the repo rule. The harness is real
and passes (2 fixtures / 0 failures, re-run by the reviewer); these strengthen
its failure detection.

- **Finding 1 — vacuous-pass risk.** The two deny probes instruct the model to
  answer `NO_EDIT_TOOL` / `NO_SUBAGENT_TOOL` but only assert negatives (no
  edit tool call, file never created, no completed subagent call). A model that
  ignores the instruction passes without evidence. Assert the marker text too.
- **Finding 2 — claim vs assertion.** "Foreground" and "batched" are printed
  but not asserted: extract `input.background` and assert it is not `true`;
  turn the batching `info` into a `check`.
- **Finding 3 — verdict provenance.** The verdict match accepts any text; the
  fixture's `arggon comment` author resolves identically for workers and
  reviewer, so provenance may not be assertable — state the limit explicitly
  or assert the reviewer call as the source of truth.
- **Finding 4 — silent degradation.** The A/B accounting uses
  `export ?? fallback` and prints via `info`; a shape change in
  `opencode session export` would print zeros and still pass. Add a check that
  both arms exported ≥1 call.

- **Finding 5 — hardcoded runtime version.** `smoke/opencode-wave.ts` (header and the accounting `info` line) still literals `opencode v2.0.7`; the harness probes `opencode --version`, so interpolate the probed value (or drop the literal) — raised when the installed runtime moved to 2.0.8 while the strings stayed behind.

## Acceptance

- [x] Deny probes assert the expected marker text in addition to the negative
      checks.
- [x] `background !== true` and the one-step batching are asserted, not just
      printed.
- [x] Verdict provenance limit documented in the harness header (or asserted if
      technically possible).
- [x] A/B sessions assert ≥1 exported call each.
- [x] `smoke:opencode:wave` still passes end-to-end; full suite green; small PR
      to `opencode2`.

- [x] Wave-harness version strings interpolate the probed runtime (no hardcoded 2.0.x literals).

## Notes

- The wave harness stays out of `npm test` (real model calls) and keeps its
  skip path.

### 2026-09-18 @Arggon
**Findings 1-5 addressed (hardening of `smoke/opencode-wave.ts`).** All new assertions green on a full real-session run; fail-direction demo recorded; no merge/no status flip from this worker.

- **F1 - vacuous-pass risk.** Both deny probes now assert the instructed marker in addition to the negative checks: `NO_EDIT_TOOL` (reviewer) and `NO_SUBAGENT_TOOL` (worker). A non-complying model fails the probe.
- **F2 - claim vs assertion.** `subagentCalls()` extracts `input.background`; phase 2 asserts no worker launch used `background: true`, phase 3 asserts the reviewer launch was foreground too, and the batching info became a real check (>=1 step with >=2 subagent calls); counts stay on an info line.
- **F3 - verdict provenance.** Limit documented in the harness header (fixture resolves the same `arggon comment` author for workers/reviewer). Phase 3 additionally captures item content before the review and asserts no pre-existing 'verdict...merge' text (vacuous-match guard), on top of the reviewer call as source of truth.
- **F4 - silent degradation.** Accounting asserts both A/B arms exported >=1 model call via `opencode session export`; a shape change fails the run instead of printing zeros (transcript fallback stays display-only).
- **F5 - runtime version.** No hardcoded version: `opencode --version` is probed once, printed in the banner and interpolated in the accounting info (`opencode v2.0.8`).

**Evidence**

- `npm run smoke:opencode:wave` - PASS: 2 fixtures / 0 failures, exit 0. All new checks ok (marker x2, foreground x2, batching, 2 vacuous-match guards, A/B export guard); batching: 2 tool call(s) in 1 step(s), 1 with >=2 subagent launches; accounting with/without block 1 model call each, delta +324 B / +95 fresh input tok.
- Fail-direction demo (scratch copy, never committed): flipping the marker expectation to `NO_EDIT_TOOL_DEMO_FLIPPED` made exactly that check FAIL while the model's reply contained the real `NO_EDIT_TOOL`; synthetic data flipped the foreground (`background:true`), batching (launches split over 2 messages), export guard (undefined export) and vacuous-match guards.
- Gates: `npm test` 70 files / 1157 passed; `npm run lint` clean; `npm run build` clean; `arggon validate` 0/0; `arggon spec validate` 0/0; `npm run smoke:opencode` 11/11.

Draft PR to `opencode2` follows. Acceptance checkboxes left for the coordinator per the worker rule.

### handoff 2026-09-18 @Arggon — next: Coordinator: review draft PR #342 (findings 1-5 assertions in smoke/opencode-wave.ts, fail-demo, wave run 2 fixtures/0 failures, smoke:opencode 11/11), verify and flip done. Worker did not merge or f…
- branch: feat/task-opencode2-orchestration-hardening
- open questions: Wave harness run covered the pre-format file (post-run edits were prettier line-wraps only, same logic); reviewer may re-run smoke:opencode:wave for independent evidence.

### 2026-09-18 @Arggon
Coordinator merge verification: static pass by the independent reviewer (all five fixes are real checks, not logs; AST-identical formatting claim; coverage audit 43→50 check literals with zero removed; phase-3 transcript corroborates the documented provenance limit) + coordinator blocking smoke: smoke:opencode:wave PASS (2 fixtures, 0 failures; new marker/background/batching/export-guard checks ok; accounting 1 call per arm, +324 B/≈+95 fresh input tokens) and smoke:opencode 11/11; suite/lint/build/validators green; merged with cli pass. Closing.
