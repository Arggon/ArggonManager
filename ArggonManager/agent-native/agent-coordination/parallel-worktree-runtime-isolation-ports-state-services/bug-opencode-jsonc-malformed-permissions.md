---
type: bug
status: done
id: bug-opencode-jsonc-malformed-permissions
title: opencode.jsonc permissions block is malformed JSONC (stray rule outside the array) — breaks permission parsing for agent sessions
assignee: Arggon
branch: fix/bug-opencode-jsonc-malformed-permissions
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [seam, config]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
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
- [x] The file parses as JSONC (comments + trailing commas tolerated) and every rule sits inside the `permissions` array; the `git push *+*` deny is preserved. Evidence: the array now closes after all four rules; the JSONC-tolerated parse yields exactly 4 rules (`git commit --no-verify*`, `git push --force*`, `git push -f*`, `git push *+*`) with no orphan rule object left.
- [x] A structural test pins parseability + the rule shape, so a stray bracket/comma is red in CI instead of silently disabling the gates. Evidence: `cli/src/opencode-permissions.test.ts` (5 cases: parses; the array holds every rule; each rule is a `shell` deny with a non-empty `resource`; the four non-negotiable denies are present with no duplicate resource; a negative control whose malformed sample IS the incident shape must throw). Negative-controlled against the real file: restoring the malformed `HEAD` bytes makes the suite fail with `SyntaxError: Expected double-quoted property name at position 887 (line 54)`, and the fixed file is 5/5 green.
- [x] Session permission probe recorded, with an honest negative. Probed in this item's worktree: `git push --force --dry-run origin HEAD` and `git commit --no-verify --dry-run -m probe` were BOTH allowed by this session's shell layer (as was `git status`) — this runtime does not enforce the project's `permissions` block at all, and `~/.config/opencode/opencode.json` carries no permissions either, so the project file is the only source. The incident proves the opposite direction: while the file was unparseable, worker sessions got `Permission denied: shell` for ordinary `git commit` / `rebase` / `merge` (fail-closed on a parse error) — that is how the defect surfaced. Live enforcement per client runtime is tracked in task-permissions-enforcement-not-observed.
