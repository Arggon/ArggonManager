---
type: task
status: todo
id: task-merge-queue-availability-unrecorded
title: Merge-queue availability constraint (organization-owned repos only) is absent from ADR 0023 and exploration-022 §F — record a dated correction so the queue is not read as an enableable setting for this user-owned repo
parent: story-ci-wall-clock
labels: [ci, docs, adr]
created: "2026-10-13"
updated: "2026-10-13"
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-ci-wall-clock/task-merge-queue-availability-unrecorded.md
  Leaves live only under a story. id is the filename stem: task-merge-queue-availability-unrecorded.
  CLI `arggon create task merge-queue-availability-unrecorded` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Merge-queue availability constraint (organization-owned repos only) is absent from ADR 0023 and exploration-022 §F — record a dated correction so the queue is not read as an enableable setting for this user-owned repo

## Context

The merge-ergonomics work (`task-merge-ergonomics-branch-updates`, PR #753) recommended
the GitHub **merge queue** as the durable fix for the branch-refresh churn — then the
standards review established the constraint: **merge queues are organization-owned-repo
only** (public org repos, or private org repos on GHEC). This repo's owner is a User
account (`gh api users/Arggon --jq .type` → `User`), so the queue is **not an enableable
setting here**; the precondition is an org transfer (or a non-native queue).

ADR 0023 and `exploration-022` §F discuss the merge queue without that availability
constraint, so a future reader can take it as a pending setting. Record a dated
correction where those documents are read.

## Acceptance

- [ ] A dated correction (the append-only idiom — never rewrite the record) lands in
      `exploration-022`'s §F context and/or an ADR 0023 amendment note: queue availability
      is org-owned-repo only; this repo is user-owned; precondition = org transfer or a
      non-native queue
- [ ] If the queue is revisited: the `merge_group` CI trigger + `push: main` ordering
      deps (ADR 0018 C3, auto-done) are the named follow-ups (already recorded on
      `task-merge-ergonomics-branch-updates`)
- [ ] `arggon spec validate` / `validate` green; docs-only

## Notes
