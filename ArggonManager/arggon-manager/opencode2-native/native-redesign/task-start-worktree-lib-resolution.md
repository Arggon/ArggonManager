---
type: task
status: todo
id: task-start-worktree-lib-resolution
title: "Worktree resolution: flip @arggon/lib to the worktree copy"
parent: native-redesign
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-21"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-start-worktree-lib-resolution.md
  Leaves live only under a story. id is the filename stem: task-start-worktree-lib-resolution.
  CLI `arggon create task start-worktree-lib-resolution` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Worktree resolution: flip @arggon/lib to the worktree copy

## Context

Follow-up from the PR #384 review (`task-native-lib-hygiene`, finding 2). The
current fix documents and enforces the limit: a linked `node_modules` makes
`@arggon/lib` resolve to the **primary** checkout, and `start` reports the
affected workspace packages (`linkedWorkspaces`, additive). The real flip was
deferred because a link farm pointing `@arggon/lib` at the worktree copy needs
`<worktree>/lib/dist` **before** the claim commit's pre-commit gate — either
`start` builds the kernel (layering question) or
`bug-start-worktree-node-modules` regresses.

## Acceptance

- [ ] Decide and implement one of: `start` builds the kernel before the gate,
      a per-worktree link farm with a pre-built `lib/dist`, or a documented
      permanent limit.
- [ ] If flipped: tests cover a fresh worktree where the CLI resolves
      `@arggon/lib` to the worktree copy, and the pre-commit gate still runs.
- [ ] Docs (`CONTRIBUTING`/`README`/`json-output`) and the skill match the
      behavior; no regression of `bug-start-worktree-node-modules`.
- [ ] `arggon validate` green; CI green.

## Notes

- Filed from the PR #384 review; the current documented+enforced behavior is
  accepted meanwhile.
