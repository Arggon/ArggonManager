---
type: task
status: in_progress
id: task-spec-analyze-baseline
title: "spec analyze --baseline: persisted findings baseline per wave"
assignee: Arggon
branch: feat/task-spec-analyze-baseline
parent: story-spec-pipeline
labels: [p2]
created: "2026-09-16"
updated: "2026-09-16"
claimed_at: "2026-09-16T21:25:45.567Z"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-spec-pipeline/task-spec-analyze-baseline.md
  Leaves live only under a story. id is the filename stem: task-spec-analyze-baseline.
  CLI `arggon create task spec-analyze-baseline` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec analyze --baseline: persisted findings baseline per wave

## Context

Rollout step 3 of the spec-corpus migration proposal: during the ArggonStores-am refactor, "spec analyze without NEW findings vs baseline" was enforced by MANUAL JSON diffing across waves. `spec analyze --baseline <file>` persists the findings snapshot so the gate is verifiable per PR/wave. Complements task-spec-audit (the audit FINDS duplication; the baseline GATES analyze findings). Effort S-M.

## Acceptance

- [ ] `arggon spec analyze --baseline <file>`: compares current findings against a persisted baseline snapshot; reports only NEW findings (and resolved ones); exit code policy documented (new findings = non-zero? flag-controlled) — decide + document
- [ ] `--save-baseline <file>` (or analyze --out) writes the snapshot (deterministic ordering so diffs are meaningful)
- [ ] Tests: baseline round-trip, new-finding detection, resolved-finding reporting, deterministic ordering; docs/json-output + README additive
- [ ] The ArggonStores-am-style wave gate becomes: save-baseline once, assert no-new per wave — documented in README as the recommended flow

## Notes

### 2026-09-16 @Arggon
REVIEW (coordinator) — APPROVED, merging PR #292.

Verified: full diff read (spec.ts baseline engine, cli.ts option wiring on the existing command — no subcommands, spec-004 additive section, e2e tests); suite 976/976 green, lint/build/validate clean; doctor 0 modified / 0 drifted. Live probe of the wave gate on this repo's own specs: save-baseline (3 findings/6 specs) -> compare 0 new exit 0; injected a dirty spec -> 4 new findings reported with evidence, exit 1 (gate bites); two consecutive saves byte-identical (deterministic, committable snapshots confirmed).

Exit-code policy accepted: gate = exit 1 on >=1 new finding only where a caller declared a baseline via --baseline; --no-fail-on-new opts out; plain analyze contract (findings never fail) untouched; --json gate-fail keeps ok:true with additive baseline payload, exit code carries the gate. Rationale documented in spec-004 + README.

Nits (non-blocking): human --save-baseline output prints only the baseline-written line while the option help says 'then report as usual' (JSON carries the full findings; fine); snapshot ordering uses localeCompare — same-machine deterministic, a theoretical cross-ICU reorder would only churn committed baselines, not break the set-based comparison.
