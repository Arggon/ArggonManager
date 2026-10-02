---
type: bug
status: todo
id: bug-task-permissions-enforcement-not-observed
title: "opencode.jsonc permissions: the four shell denies are not enforced by the client runtimes we actually use"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [seam, config]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-task-permissions-enforcement-not-observed.md
  Leaves live only under a story. id is the filename stem: bug-task-permissions-enforcement-not-observed.
  CLI `arggon create bug task-permissions-enforcement-not-observed` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# opencode.jsonc permissions: the four shell denies are not enforced by the client runtimes we actually use

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Found while fixing bug-opencode-jsonc-malformed-permissions: after the file was repaired, the coordinator session's shell layer still ALLOWED `git push --force --dry-run origin HEAD` and `git commit --no-verify -m probe` (dry runs, no side effects) — i.e. the project's `permissions` block is not enforced by this runtime. `~/.config/opencode/opencode.json` carries no permissions block, so the project file is the only source. What the malformed file proved is the opposite direction: unparseable config made every shell call fail closed (`Permission denied: shell`), which is how the defect surfaced.

## Acceptance
- [ ] Determine per client runtime (OpenCode V2 session, ZCode plugin, headless/agent seams) whether the project `permissions` block is read at all, and record which layer honors it.
- [ ] If it is not honored, decide the carrier: an enforceable gate in the methodology (kernel/plugin-side refusal the way steals/reopens are gated) or documented client setup; do not leave the file claiming enforcement it does not deliver.
- [ ] A probe harness that runs one denied and one allowed command per supported runtime, wired into the gates where practical.
