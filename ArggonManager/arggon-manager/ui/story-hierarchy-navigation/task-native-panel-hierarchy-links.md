---
type: task
status: done
id: task-native-panel-hierarchy-links
title: "OpenCode board panel: parent and children navigation"
assignee: arggon-delivery-lead
branch: feat/task-native-panel-hierarchy-links
parent: story-hierarchy-navigation
labels: []
created: "2026-10-11"
updated: "2026-10-11"
worktree_path: /home/arggon/Projects/ArggonManager-task-native-panel-hierarchy-links
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

- [x] The panel's detail/selection surface shows the parent (activatable to open the parent) and the children (each activatable), or documents with owner sign-off why the panel's component model cannot carry it and what the fallback is
- [x] Resolution reads the inlined kernel's `parent` edges; bundle regenerated (`npm run check:plugin` green) with no board-surface export broken
- [x] `arggon validate` green; prettier clean; PR opened with impact class (panel is a shipped adapter seam — likely Behavioral with the ADR 0016 channel reference)

## Notes

### 2026-10-11 @arggon-maker

Evidence for standards review (maker report; commit b139246c on feat/task-native-panel-hierarchy-links, pushed).

What changed (7 files, scope-kept; cli/src/board.ts, cli/src/tui.ts, templates/ untouched):

- opencode/plugins/arggon/board.ts: BOARD_HIERARCHY_CHILD_KEYS=9, boardParentId/boardChildrenOf pure resolvers over the inlined kernel parent edges; BoardItemDetail gains parent/children; boardDetailLines renders parent ([p] hint) + numbered children ([1]..[9]) with honest none/missing/overflow rows outside the acceptance/body budget, sanitized at render.
- opencode/plugins/arggon/tui.tsx: controller gains jumpParent/jumpChild (select + open detail); keymap adds p + 1..9; header documents the activation model (plain-text rows, no click surface; keyboard activation is the agreed mechanism, not display-only).
- opencode/plugins/arggon/index.ts + cli/src/plugin-bundle.ts: forward the 3 new board names (BUNDLE_EXPORTS parity kept); index.bundle.ts regenerated.
- board.test.ts + tui.test.ts: hierarchy resolvers, detail fields/rendering, none/missing/overflow, hostile bytes, parent/child jumps + toasts, keymap table.

Activation: Enter opens detail showing parent + children; p opens parent detail; 1..9 open the Nth child detail (id-sorted). No-parent toasts 'no parent'; missing edge shows '(missing)' and toasts 'parent not found'; out-of-range digit toasts 'no child N'; 9+ children show first 9 + overflow row (rest via tree cursor).

Gates observed (all in worktree):

- arggon validate --json: ok true, 0 errors
- prettier --check on all 7 touched files: clean
- vitest board+tui: 40/40 pass; full opencode/plugins/arggon + plugin-copy: 242/242 pass
- npm run build:plugin: 47 modules, 544652 bytes; npm run check:plugin exit 0 (post-commit)
- push git push -u origin feat/task-native-panel-hierarchy-links: new branch, exit 0

PR impact class (for delivery lead to state on PR): Behavioral (panel is a shipped adapter seam) with the ADR 0016 adopter-upgrade-channel reference per agents.md Changing the methodology itself.

Not done: acceptance boxes unticked, status untouched (delivery lead flips after merge). No tracker items filed.

### handoff 2026-10-11 @arggon-maker — next: Open PR from feat/task-native-panel-hierarchy-links stating Behavioral impact plus ADR 0016 channel

- branch: feat/task-native-panel-hierarchy-links
- open questions: Digit binds 1-9 unit-pinned only, no live OpenCode runtime probe; playbook TUI key table update deferred to lead

### 2026-10-11 @ses_ed2ed434cffdHsqB0EV526IjUT

verdict: approve (panel p/1-9 jumps, B1 closed by live runtime evidence)

- Read the worktree diff (board.ts + tui.tsx + index.ts + bundle + plugin-bundle.ts + 2 test files + own item file) — no cli/src/board.ts, no cli/src/tui.ts, no templates/, no skills/; scope stays on the item
- Standards-reviewer: request-changes SOLELY on missing execution evidence (B1, no code defect found); all 7 verifier probes now green in the worktree — vitest 40/40 + 11/11 parity, check:plugin exit 0, validate ok, prettier clean, smoke:tui pass, and the live gap-closer drive: p→parent detail, 1→first child, out-of-range toast, root toast, all observed on real panel frames
- Lead calls: (N1) playbook follow-up filed as task-playbook-panel-hierarchy-keys — merge unblocked; (N2) PR states impact: none (no methodology carrier touched), correcting the item's over-declared Behavioral; (N3/N4) noted as future hygiene, out of scope
- Recommendation: open PR (merge, not squash), merge on green CI; lead ticks Acceptance after merge and flips done
