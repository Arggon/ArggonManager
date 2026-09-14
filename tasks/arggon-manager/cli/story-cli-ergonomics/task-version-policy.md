---
type: task
status: todo
id: task-version-policy
title: "Version policy: package.json version is never bumped (--version prints 0.0.0)"
parent: story-cli-ergonomics
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-cli-ergonomics/task-version-policy.md
  Leaves live only under a story. id is the filename stem: task-version-policy.
  CLI `arggon create task version-policy` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Version policy: package.json version is never bumped (--version prints 0.0.0)

## Context

`arggon --version` prints 0.0.0 — package.json version is never bumped, so there is no way to audit which build an agent or user ran (the estanteria and racha experiments both needed md5 comparisons of dist/cli.js to answer "which version is this?").

## Acceptance

- [ ] A version policy lands (decision + docs): either bump package.json per release wave (changelog-driven) or derive --version from git describe at build time
- [ ] `arggon --version` reports the landed scheme; documented in README
