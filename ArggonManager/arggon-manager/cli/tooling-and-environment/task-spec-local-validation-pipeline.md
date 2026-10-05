---
type: task
status: todo
id: task-spec-local-validation-pipeline
title: "Spec: the local validation pipeline — gate-list ownership, lane selection, the printed profile, and the CI-only gates the local verdict cannot cover"
parent: tooling-and-environment
labels: [ci, spec, methodology]
created: "2026-10-05"
updated: "2026-10-05"
depends_on: [task-adr-local-validation-pipeline]
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-spec-local-validation-pipeline.md
  Leaves live only under a story. id is the filename stem: task-spec-local-validation-pipeline.
  CLI `arggon create task spec-local-validation-pipeline` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec: the local validation pipeline — gate-list ownership, lane selection, the printed profile, and the CI-only gates the local verdict cannot cover

## Context

Follows [`task-adr-local-validation-pipeline`](task-adr-local-validation-pipeline.md);
exploration of record
[`exploration-local-validation-pipeline-023`](../../../../docs/explorations/exploration-local-validation-pipeline-023.md).

The exploration is **thinking, not building**; this is where its hunted edge cases
become acceptance criteria. Its edge-case table already resolved every dimension to one
of: a criterion below, an explicit non-goal, or the bug
`bug-native-start-cold-ci-skips-move-leg`. Nothing stayed "unknown" — so this spec
starts from a settled design, and its first job is to be _scanned_ clean.

**Hard gate (ADR 0017): no implementation task may be claimed before this spec exists
and `arggon spec analyze` reports no NEW findings.** Do not file implementation tasks
from this spec until that is true.

The acceptance criteria below are the edge table's _criterion_ rows verbatim in
substance — input validation (closed lane set, unknown lane exits non-zero, CI env vars
must not change local behaviour), empty state (an empty or unrecognised gate set is an
error, never a success — a gate that can silently match nothing is a false green),
concurrency (safe in sibling worktrees, or an explicit lock — `$TMPDIR` plus the real
git worktree `smoke:worktree-playwright` creates), failure reporting (name the failed
gate, its exit code and its wall time), persistence (**`build` is a mandatory first
lane**, because omitting it is a measured false red), observability (bounded `--json`
verdict per ADR 0006), and environment (two declared profiles, and **the resolved
profile is printed**, since the `opencode` binary's presence changes a gate's strength).

## Acceptance

- [ ] Spec exists at `ArggonManager/docs/specs/spec-local-validation-pipeline-NNN.md`
      and `arggon spec validate` is green
- [ ] `arggon spec analyze` reports **0 NEW** findings (record the command and its
      output in the item body) — this is the gate the next item depends on
- [ ] Every one of the criteria in the Context above appears as a numbered acceptance
      criterion with an observable expected-vs-observed form
- [ ] The spec states the **ordered lane list** and each lane maps to exactly one
      existing npm script (10 of 11 `cli`-job steps today; the PR-scoped version guard
      is explicitly CI-only because it needs a PR base SHA)
- [ ] The spec names the CI-only gates the local verdict **cannot** cover — the
      version guard, the seam pinned-lag assertion, publishing — so a green local run is
      never read as a green CI run
- [ ] The spec keeps every BLOCKING gate. Narrowing one for speed or convenience is out
      of scope by ADR 0023 §Alternatives and by
      `ArggonManager/docs/engineering.md` §Review bar
- [ ] The spec states the rollout order and that each step is one revert:
      (1) parity test first, red against today's `ci.yml` → (2) the npm lanes →
      (3) reduce the workflow steps to `npm run <lane>` → (4) document the profile.
      Only step 3 changes CI behaviour, and it changes nothing about _what_ runs
- [ ] `depends_on: task-adr-local-validation-pipeline` — the spec is written against a
      decided rule, not a guessed one

## Notes

Not a plan. The plan and the implementation tasks follow this spec, not the other way
round.
