---
type: task
status: todo
id: task-spec-validate
title: arggon spec validate + templates
parent: story-spec-pipeline
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-spec-pipeline/task-spec-validate.md
  Leaves live only under a story. id is the filename stem: task-spec-validate.
  CLI `arggon create task spec-validate` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon spec validate + templates

## Context

Read-only validator for `docs/specs/*.md` and `docs/plans/*.md` frontmatter and section structure.

## Acceptance

- [ ] Required frontmatter (`spec_id`/`plan_id`, `title`, `status`, `created`) and section checks; `--json` issues
- [ ] `arggon spec new <slug>` scaffolds from the template
