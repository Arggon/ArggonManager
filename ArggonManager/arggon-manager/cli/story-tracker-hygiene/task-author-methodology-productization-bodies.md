---
type: task
status: in_progress
id: task-author-methodology-productization-bodies
title: Author Context and Acceptance for the 12 open methodology-productization containers
assignee: arggon-delivery-lead
branch: feat/task-author-methodology-productization-bodies
parent: story-tracker-hygiene
labels: []
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T23:02:11.824Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-author-methodology-productization-bodies
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-methodology-productization-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-methodology-productization-bodies.
  CLI `arggon create task author-methodology-productization-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author Context and Acceptance for the 12 open methodology-productization containers

## Context

The `methodology-productization` initiative subtree (initiative + 3 epics + 8 stories, all open) still carries scaffold-placeholder bodies — no Context, no Acceptance — as filed in `bug-template-only-bodies-ship-green`. An initiative with no stated Context cannot be reviewed for product acceptance, and stories with no Acceptance leave their leaves' purpose unstated. The 12 files (verified 2026-10-11):

- `methodology-productization` (initiative)
- `agent-role-model`, `external-agent-tooling`, `native-agent-adapters` (epics)
- `role-model-foundation`, `external-harness-evaluation`, `harness-research-transfer`, `story-adapter-selection`, `story-capability-matrix`, `story-opencode-adapter` (stories; `story-claude-adapter`, `story-methodology-carriers`, `story-zcode-adapter` already have content — verify, don't overwrite)

Source material (do not invent direction): ADR 0020 (methodology-first productization), ADR 0021 (role model), ADR 0022 (external-tooling decline), ADR 0026 (decision brief), spec-methodology-adapters-017, and each container's existing children titles.

## Acceptance

- [ ] All 12 open containers above carry a real `## Context` (why it exists, in one reader's plain words) and a real `## Acceptance` (what complete means — checkboxes only where the container can check them; prose where completion is the children's terminal state plus product-owner acceptance)
- [ ] No existing real prose is overwritten — the three stories with content keep theirs; additions only where placeholders stand
- [ ] Wording stays domain-neutral per ADR 0021 §6.2 (no new software-locked bars; software stays a worked example)
- [ ] `x-generated` untouched (these are tracker items, not generated docs); prettier clean; `arggon validate` green; PR opened with impact class Advisory

## Notes

### handoff 2026-10-11 @ses_ed2caf24bffejg5yc641LmkH43 (session: ses_ed2caf24bffejg5yc641LmkH43) — next: Push branch, open PR (impact class Advisory), route to standards review
- branch: feat/task-author-methodology-productization-bodies
- open questions: Scope said 9 files but listed 10; tree has 11 open not 12; 2 done stories still placeholder — left untouched, confirm
