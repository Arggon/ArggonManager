---
type: task
status: in_progress
id: task-formatter-override-template
title: Ship the formatter git-root anchor in the generated opencode.jsonc template (adopters hit the same worktree bypass)
assignee: Arggon
branch: feat/task-formatter-override-template
parent: tooling-and-environment
labels: [tooling, init, product]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T14:29:03.291Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-formatter-override-template
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-formatter-override-template.md
  Leaves live only under a story. id is the filename stem: task-formatter-override-template.
  CLI `arggon create task formatter-override-template` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Ship the formatter git-root anchor in the generated opencode.jsonc template (adopters hit the same worktree bypass)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from task-session-formatter-bypasses-prettierignore (PR #531): the bypass (session formatter runs prettier with the session cwd; sibling-worktree files bypass .prettierignore) is generic to the arggon start layout, but the fix — the formatter.prettier.command override anchoring at the edited file's git root — lives only in THIS repo's hand-edited opencode.jsonc (now adopter-owned; init skips it). The GENERATED template (templates/opencode.jsonc source in the product) still emits formatter: true, so every adopter using start --worktree hits the same ~900-line reformat churn.

## Acceptance
- [ ] Product decision recorded: ship the override in the template (recommended — same layout guarantees the same bug) or document the bypass + manual fix in the init output/docs instead.
- [ ] If shipping: templates updated + a template-vs-fixture test that the override survives regeneration; adopter-modified opencode.jsonc files are skipped by init (documented migration note).
- [ ] changelog entry in the next release.
