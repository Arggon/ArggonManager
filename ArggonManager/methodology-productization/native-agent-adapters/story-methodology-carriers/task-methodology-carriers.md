---
type: task
status: todo
id: task-methodology-carriers
title: Declare the methodology in carriers + README (plan T1)
parent: story-methodology-carriers
labels: []
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-methodology-carriers/task-methodology-carriers.md
  Leaves live only under a story. id is the filename stem: task-methodology-carriers.
  CLI `arggon create task methodology-carriers` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Declare the methodology in carriers + README (plan T1)

## Context

Declare scope/invariants/version/upgrade-channel of the methodology in agents.md, engineering.md, convention.md headers; README §The methodology with links to carriers and the adapter matrix

## Acceptance

- [ ] `README.md` links every carrier in one hop
- [ ] carriers carry the same invariant list verbatim
- [ ] PR states impact class (Behavioral) per agents.md §Changing the methodology itself
- [ ] `arggon validate` green

## Notes

### 2026-10-02 @ses_f02038341ffeqxEIdpXnpaLcf9
Gates in worktree /home/arggon/Projects/ArggonManager-task-methodology-carriers (branch feat/task-methodology-carriers, commit 548f5aed): npm run build ok; npm test 118 files / 2166 tests passed; npm run lint clean; npm run arggon -- validate ok (0 warnings, convention v5). README.md gained a 'The methodology' section linking agents.md, engineering.md, convention.md and skills/arggon-cli/SKILL.md in one hop plus the adapters epic + spec-methodology-adapters-017; agents.md/engineering.md/convention.md each carry the same scope/invariant-list/version/ADR 0016 upgrade-channel header verbatim. PR #592 states Impact class: Behavioral per agents.md §Changing the methodology itself.
