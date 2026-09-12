---
type: task
status: done
id: task-init-docs-tests
title: "Init docs: tests and documentation"
assignee: Arggon
parent: story-init-docs
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-init-docs-tests.md
  Leaves live only under a story. id is the filename stem: task-init-docs-tests.
  CLI `arggon create task init-docs-tests` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Init docs: tests and documentation

## Context

Tests and docs for the generator.

## Acceptance

- [x] Tests: fresh init creates the full set; second init skips (idempotent); --full tier-2; existing files never overwritten; placeholders rendered
- [x] README/agents.md document the generated set
