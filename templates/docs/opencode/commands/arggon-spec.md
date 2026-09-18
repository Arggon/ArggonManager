---
description: Write a spec (and plan) with the CLI, then verify it
---

Turn $ARGUMENTS into a reviewable spec following the pipeline in
`docs/agents.md` §Documentation maintenance (decision table:
`references/methodology.md` in the `arggon-cli` skill):

1. Classify the work: trivial changes need no spec; non-trivial features get a
   spec, and multi-wave work a plan too.
2. Scaffold with the CLI — never hand-create the files:
   `arggon spec new <slug> [--title "<title>"] [--plan]`.
3. Write `docs/specs/spec-<slug>-NNN.md` (with `--plan`,
   `docs/plans/plan-<slug>-NNN.md`): purpose, synopsis, invariants,
   flags/JSON shapes, acceptance criteria; the plan breaks implementation into
   ordered tasks that link back to the spec.
4. Verify mechanically: `arggon spec validate` must be clean, and
   `arggon spec analyze` report-only findings should be resolved by editing the
   spec (never invent data to silence them).
5. Report the created paths, the validate result and any open findings.
