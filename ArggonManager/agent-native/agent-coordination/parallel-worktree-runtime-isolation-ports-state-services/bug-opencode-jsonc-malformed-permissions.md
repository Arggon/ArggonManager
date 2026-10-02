---
type: bug
status: in_progress
id: bug-opencode-jsonc-malformed-permissions
title: opencode.jsonc permissions block is malformed JSONC (stray rule outside the array) — breaks permission parsing for agent sessions
assignee: Arggon
branch: fix/bug-opencode-jsonc-malformed-permissions
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [seam, config]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T04:24:55.811Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-opencode-jsonc-malformed-permissions
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-opencode-jsonc-malformed-permissions.md
  Leaves live only under a story. id is the filename stem: bug-opencode-jsonc-malformed-permissions.
  CLI `arggon create bug opencode-jsonc-malformed-permissions` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# opencode.jsonc permissions block is malformed JSONC (stray rule outside the array) — breaks permission parsing for agent sessions

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
`opencode.jsonc` on `main` does not parse: the `permissions` array closes after the third rule, then a stray `{ "action": "shell", "resource": "git push *+*", ... }` rule and a dangling `]` / `}` follow it. Introduced by db321c25 (PR #531). JSONC-parse: `Illegal trailing comma before end of array` plus the orphan rule. Observed effect in worker sessions: inline `git commit` / `git merge` / `git rebase` refused with "Permission denied: shell" (the same commands succeeded through a script wrapper). W4's workflow gates are therefore not enforced as written and the file's own comment ("delete a rule here if your workflow needs it, this file is yours once edited") is misleading while it does not parse.

## Acceptance
- [ ] The file parses as JSONC (comments stripped) and the permissions rules are all inside the array; `git push *+*` deny preserved.
- [ ] A structural test pins parseability + the rule shape, so a stray bracket/comma fails CI instead of silently disabling the gates.
- [ ] Confirm the session permission layer honors the three denies (a probe of one denied and one allowed command, recorded on the item).
