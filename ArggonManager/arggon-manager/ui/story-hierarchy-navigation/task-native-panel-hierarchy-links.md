---
type: task
status: todo
id: task-native-panel-hierarchy-links
title: "OpenCode board panel: parent and children navigation"
parent: story-hierarchy-navigation
labels: []
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-hierarchy-navigation/task-native-panel-hierarchy-links.md
  Leaves live only under a story. id is the filename stem: task-native-panel-hierarchy-links.
  CLI `arggon create task native-panel-hierarchy-links` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode board panel: parent and children navigation

## Context

Parent story `story-hierarchy-navigation`: the OpenCode board panel (`opencode/plugins/arggon/tui.tsx`) renders no parent/child/breadcrumb/ancestor information at all — the thinnest of the three surfaces. Panel users cannot see, let alone walk, the hierarchy.

## Acceptance

- [ ] The panel's detail/selection surface shows the parent (activatable to open the parent) and the children (each activatable), or documents with owner sign-off why the panel's component model cannot carry it and what the fallback is
- [ ] Resolution reads the inlined kernel's `parent` edges; bundle regenerated (`npm run check:plugin` green) with no board-surface export broken
- [ ] `arggon validate` green; prettier clean; PR opened with impact class (panel is a shipped adapter seam — likely Behavioral with the ADR 0016 channel reference)

## Notes

### 2026-10-11 @ses_ed2ed434cffdHsqB0EV526IjUT
verdict: approve (panel p/1-9 jumps, B1 closed by live runtime evidence)
- Read the worktree diff (board.ts + tui.tsx + index.ts + bundle + plugin-bundle.ts + 2 test files + own item file) — no cli/src/board.ts, no cli/src/tui.ts, no templates/, no skills/; scope stays on the item
- Standards-reviewer: request-changes SOLELY on missing execution evidence (B1, no code defect found); all 7 verifier probes now green in the worktree — vitest 40/40 + 11/11 parity, check:plugin exit 0, validate ok, prettier clean, smoke:tui pass, and the live gap-closer drive: p→parent detail, 1→first child, out-of-range toast, root toast, all observed on real panel frames
- Lead calls: (N1) playbook follow-up filed as task-playbook-panel-hierarchy-keys — merge unblocked; (N2) PR states impact: none (no methodology carrier touched), correcting the item's over-declared Behavioral; (N3/N4) noted as future hygiene, out of scope
- Recommendation: open PR (merge, not squash), merge on green CI; lead ticks Acceptance after merge and flips done
