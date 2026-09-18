---
type: task
status: todo
id: task-opencode2-orchestration-hardening
title: "Wave harness hardening: probe marker assertions, batching checks, A/B export guard"
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
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

- [ ] Deny probes assert the expected marker text in addition to the negative
      checks.
- [ ] `background !== true` and the one-step batching are asserted, not just
      printed.
- [ ] Verdict provenance limit documented in the harness header (or asserted if
      technically possible).
- [ ] A/B sessions assert ≥1 exported call each.
- [ ] `smoke:opencode:wave` still passes end-to-end; full suite green; small PR
      to `opencode2`.

- [ ] Wave-harness version strings interpolate the probed runtime (no hardcoded 2.0.x literals).

## Notes

- The wave harness stays out of `npm test` (real model calls) and keeps its
  skip path.
