---
type: task
status: todo
id: task-convention-x-github-doc
title: "generated convention.md extensions table: document the new x-github namespace"
parent: story-init-docs
labels: []
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-convention-x-github-doc.md
  Leaves live only under a story. id is the filename stem: task-convention-x-github-doc.
  CLI `arggon create task convention-x-github-doc` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# generated convention.md extensions table: document the new x-github namespace

## Context

Follow-up from the task-issue-roundtrip review (PR #228): the round-trip landed a new `x-github` namespaced extension (`issue-roundtrip`, default OFF), but the generated docs/convention.md extensions table (task-init-convention-extensions) does not list it — an adopter reading the generated convention doc cannot discover the gate.

## Acceptance

- [ ] templates/docs/convention.md extensions table gains the `x-github` row (one line: issue round-trip on done, default OFF)
- [ ] ArggonManager's own docs/convention.md matches (it is the normative reference the template points to)
- [ ] init-docs extensions assertion covers x-github

## Notes
