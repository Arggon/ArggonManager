---
type: story
status: done
id: story-import-issues
title: Import GitHub issues one-shot
assignee: Arggon
branch: feat/story-import-issues
parent: ecosystem-ops
labels: []
created: "2026-09-11"
updated: "2026-09-12"
claimed_at: "2026-09-12T00:45:33.818Z"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-import-issues/story-import-issues.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Import GitHub issues one-shot

## Context

`docs/agents.md` §0 promises pre-existing GitHub issues migrate into `tasks/` the next time they are touched. A one-shot import closes that promise for every adopter with an issue backlog.

## Acceptance

- [x] `arggon import-issues` maps open issues to `todo` tasks, closed to `done`, idempotently (re-run imports nothing)
- [x] Cross-references preserved (issue number in body/Notes); `--dry-run` previews
