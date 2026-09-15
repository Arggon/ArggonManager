---
type: bug
status: done
id: bug-create-path-envelope
title: create --json dropped top-level path field while show/comment keep it (envelope inconsistency)
assignee: Arggon
branch: fix/bug-create-path-envelope
parent: story-github
labels: []
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/bug-create-path-envelope.md
  Leaves live only under a story. id is the filename stem: bug-create-path-envelope.
  CLI `arggon create bug create-path-envelope` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# create --json dropped top-level path field while show/comment keep it (envelope inconsistency)

## Context

Follow-up from the task-mcp-parity-full review (PR #237): `create --json` no longer emits a top-level `path` field (only `item.path`), while `show`/`comment` still carry top-level `path` — envelope-shape inconsistency across commands introduced with the compact-envelope default (PR #203) or before. Consumers reading `path` from create must now know it moved inside `item`.

## Acceptance

- [x] Decide + align: either create restores the additive top-level `path` or show/comment drop theirs — one convention, documented in docs/json-output.md (schemaVersion unchanged)
- [x] Tests assert the aligned shape in all three commands

## Notes
