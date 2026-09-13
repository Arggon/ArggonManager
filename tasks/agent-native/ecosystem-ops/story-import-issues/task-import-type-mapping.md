---
type: task
status: done
id: task-import-type-mapping
title: "Import: label-based type mapping and issue number in frontmatter"
assignee: Arggon
branch: feat/task-import-type-mapping
parent: story-import-issues
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-import-issues/task-import-type-mapping.md
  Leaves live only under a story. id is the filename stem: task-import-type-mapping.
  CLI `arggon create task import-type-mapping` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Import: label-based type mapping and issue number in frontmatter

## Context

cuentas-claras feedback: at 6 issues importing everything as tasks was fine, but it scales poorly — repos with 30 issues need type mapping.

## Acceptance

- [x] Label-based mapping: `bug` label -> bug type, `enhancement`/`feature` -> task, unrecognized labels still map to item labels; default type task; configurable via x-import in .convention.yml
- [x] Tests: mapping per label combination; items without recognized labels default to task
