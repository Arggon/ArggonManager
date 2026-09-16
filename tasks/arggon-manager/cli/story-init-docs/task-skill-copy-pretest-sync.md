---
type: task
status: in_progress
id: task-skill-copy-pretest-sync
title: generate the .agents skill copy in a pretest/globalSetup step
assignee: Arggon
parent: story-init-docs
labels: [p3]
created: "2026-09-15"
updated: "2026-09-16"
claimed_at: "2026-09-16T01:37:23.016Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-skill-copy-pretest-sync.md
  Leaves live only under a story. id is the filename stem: task-skill-copy-pretest-sync.
  CLI `arggon create task skill-copy-pretest-sync` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# generate the .agents skill copy in a pretest/globalSetup step

## Context

Observed 2026-09-15 (coordinator local run): after merging PRs that changed the SKILL source, the local `.agents/skills/arggon-cli/SKILL.md` copy (gitignored, generated) is stale and the parity test fails spuriously until `npm run skills:sync` runs — the test failing on a build artifact adds friction without detection value (the source is the committed truth; the copy is derived).

## Acceptance

- [ ] The parity test (or a vitest globalSetup/pretest step) REGENERATES the copy from source before asserting equality — stale local copies can never fail the suite
- [ ] CI equivalence unchanged (fresh checkouts generate-then-assert as today)

## Notes
