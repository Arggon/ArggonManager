---
type: task
status: in_progress
id: task-zcode-maker-lesson-trigger
title: ZCode maker prompt does not carry the ADR 0027 lesson-promotion trigger (opencode seam got it; parity missing)
assignee: arggon-delivery-lead
branch: feat/task-zcode-maker-lesson-trigger
parent: story-zcode-adapter
labels: [methodology, zcode-seam]
created: "2026-10-13"
updated: "2026-10-14"
claimed_at: "2026-10-14T10:58:29.536Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-zcode-maker-lesson-trigger
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-zcode-adapter/task-zcode-maker-lesson-trigger.md
  Leaves live only under a story. id is the filename stem: task-zcode-maker-lesson-trigger.
  CLI `arggon create task zcode-maker-lesson-trigger` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ZCode maker prompt does not carry the ADR 0027 lesson-promotion trigger (opencode seam got it; parity missing)

## Context

`task-lesson-promotion-implementation` (PR #795, merged) landed ADR 0027's lesson-promotion rule in `ArggonManager/docs/agents.md` and the trigger sentence in `templates/docs/opencode/agents/arggon-maker.md` (plus the regenerated seam copy) — deliberately scoped to the opencode template path. The ZCode seam ships its own maker agent (`templates/docs/zcode/arggon/agents/arggon-maker.md`, regenerated into `.zcode-marketplace/arggon/agents/`), and it carries no trigger, so ZCode adopters would not receive the write-path half of ADR 0027. Raised as an open question by the PR #795 maker; the delivery lead judged it a real parity gap rather than noise.

## Acceptance

- [ ] the ZCode maker prompt carries the ADR 0027 trigger (bound ≤160 chars + mandatory citation, the same carrier list), in the seam's own wording
- [ ] the template and the generated `.zcode-marketplace/arggon/agents/arggon-maker.md` stay byte-consistent; provenance/checksums refreshed; any seam test updated
- [ ] impact class stated (Behavioral — agent contract change; ADR 0016 channel noted); `arggon validate` + affected suites green; prettier clean

## Notes
