---
type: task
status: in_progress
id: task-skill-copy-sync
title: generated .agents skill copy drifts from skills/ source; add sync mechanism or drift test
assignee: Arggon
parent: story-init-docs
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T19:17:00.066Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-skill-copy-sync.md
  Leaves live only under a story. id is the filename stem: task-skill-copy-sync.
  CLI `arggon create task skill-copy-sync` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# generated .agents skill copy drifts from skills/ source; add sync mechanism or drift test

## Context

`skills/arggon-cli/SKILL.md` is the single source; `arggon init` copies it to
`.agents/skills/arggon-cli/SKILL.md` in adopter trees. In THIS repo the
generated copy is acked (`tasks/.convention.yml` x-generated) and has drifted
from the source repeatedly (missing acceptance-aware cascade pitfall, stale
init flag wording, reopen gating — noted by PR #153's review; partially
re-synced by hand in PRs #153/#163). There is no mechanism keeping the copy
in sync: every SKILL.md edit requires remembering to edit both files and
re-ack.

## Acceptance

- [ ] A sync mechanism lands: either init-docs regenerates the copy on validate/doctor with a drift error, or a test fails when the two files diverge (modulo nothing — byte-equal)
- [ ] Current drift (if any) resolved; doctor reports the copy as acknowledged and matching

## Notes
