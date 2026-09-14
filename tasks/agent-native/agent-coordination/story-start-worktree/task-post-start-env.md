---
type: task
status: in_progress
id: task-post-start-env
title: "post-start hook environment: document PATH inheritance (or login-shell option)"
assignee: Arggon
branch: feat/task-post-start-env
parent: story-start-worktree
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T03:41:11.922Z"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/task-post-start-env.md
  Leaves live only under a story. id is the filename stem: task-post-start-env.
  CLI `arggon create task post-start-env` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# post-start hook environment: document PATH inheritance (or login-shell option)

## Context

Found by the racha experiment (2026-09-14): x-worktree.post-start: "cargo check" always failed with postStart.ok:false — the hook inherits the invoking arggon process environment, and rustup installs toolchains in ~/.cargo/bin which was not in the PATH of the shell that launched arggon (installed mid-session; mise/rustup users hit this constantly).

## Acceptance

- [ ] Documented in docs/convention.md x-worktree section: hooks inherit the invoking shell environment — use absolute paths (e.g. ~/.cargo/bin/cargo) or run via the user's login shell
- [ ] Optional enhancement landed (decide during implementation): a `sh -lc` variant or explicit env passthrough note; failing either way, the documented workaround must be verified live
