---
type: task
status: done
id: task-methodology-carriers
title: Declare the methodology in carriers + README (plan T1)
assignee: Arggon
branch: feat/task-methodology-carriers
parent: story-methodology-carriers
labels: []
created: "2026-10-02"
updated: "2026-10-02"
worktree_path: /home/arggon/Projects/ArggonManager-task-methodology-carriers
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

- [x] `README.md` links every carrier in one hop
- [x] carriers carry the same invariant list verbatim
- [x] PR states impact class (Behavioral) per agents.md §Changing the methodology itself
- [x] `arggon validate` green

## Notes

### 2026-10-02 @ses_f02038341ffeqxEIdpXnpaLcf9
Gates in worktree /home/arggon/Projects/ArggonManager-task-methodology-carriers (branch feat/task-methodology-carriers, commit 548f5aed): npm run build ok; npm test 118 files / 2166 tests passed; npm run lint clean; npm run arggon -- validate ok (0 warnings, convention v5). README.md gained a 'The methodology' section linking agents.md, engineering.md, convention.md and skills/arggon-cli/SKILL.md in one hop plus the adapters epic + spec-methodology-adapters-017; agents.md/engineering.md/convention.md each carry the same scope/invariant-list/version/ADR 0016 upgrade-channel header verbatim. PR #592 states Impact class: Behavioral per agents.md §Changing the methodology itself.

### handoff 2026-10-02 @ses_f02038341ffeqxEIdpXnpaLcf9 (session: ses_f02038341ffeqxEIdpXnpaLcf9) — next: Coordinator reviews PR #592 and merges; item stays in_progress until merge.
- branch: feat/task-methodology-carriers
- open questions: None — T1 complete; T2/T3 remain for other tasks.

### 2026-10-02 @ses_f01ef6a8dffefttjZZwGqQtWss
verdict: approve

Evidence checked by reading (branch feat/task-methodology-carriers, PR #592, 5 files / +43 -1):
- Identical methodology block: extracted lines 3-9 of ArggonManager/docs/{agents,engineering,convention}.md at the PR head — byte-identical (diff exit 0 across all three), covering scope ("any project — not only software"), the same verbatim invariant list, version tracking the package, and the ADR 0016 upgrade-channel pointer.
- README §The methodology: one-hop relative links to ArggonManager/docs/agents.md, ArggonManager/docs/engineering.md, ArggonManager/docs/convention.md, skills/arggon-cli/SKILL.md, the native-agent-adapters epic and docs/specs/spec-methodology-adapters-017.md — all target paths confirmed present on disk.
- Impact class: PR body states "## Impact class: Behavioral" and cites agents.md §Changing the methodology itself.
- No unrelated reformatting: diff is purely additive (+7 per carrier doc, +17 README, +5/-1 item frontmatter for the claim metadata); no other lines touched.
- No cross-item files: the only tracker file touched is task-methodology-carriers.md itself.

## Probes needed
- `npm run arggon -- validate` (cwd /home/arggon/Projects/ArggonManager-task-methodology-carriers) — confirm 0 warnings / convention v5, since validate-green is an acceptance item and I did not execute it. Green CI otherwise claimed in PR/item notes.
