---
type: task
status: in_progress
id: task-native-headless-ci
title: Headless bootstrap + CI adapter
assignee: Arggon
branch: feat/task-native-headless-ci
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-21"
claimed_at: "2026-09-21T15:19:06.646Z"
depends_on: [task-native-tui]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-headless-ci
---

<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-headless-ci.md
  Leaves live only under a story. id is the filename stem: task-native-headless-ci.
  CLI `arggon create task native-headless-ci` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Headless bootstrap + CI adapter (W6)

## Context

W6 of `plan-native-first-011`. Keep `init`/`validate`/`doctor`/`--json` in the packaged bin for bootstrap and model-less CI; provide the CI recipe (workflow snippet) and a fresh-clone fixture. This is the bootstrap artifact that candidate B keeps (ADR 0011).

## Acceptance

- [x] Fresh clone → `init` → CI green without a model.
- [x] `npm pack` install test: bin works, `--json` envelopes unchanged.
- [x] CI recipe documented and used by at least one adopter-shaped fixture.
- [x] MCP is not required anywhere in the flow.

## Notes

- Depends on W1. Gates adoption; B→A revisit criteria are in ADR 0011.
