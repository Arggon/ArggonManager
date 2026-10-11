---
type: task
status: done
id: task-web-board-hierarchy-links
title: "Web board detail drawer: link parent and list children"
assignee: arggon-delivery-lead
branch: feat/task-web-board-hierarchy-links
parent: story-hierarchy-navigation
labels: []
created: "2026-10-11"
updated: "2026-10-11"
worktree_path: /home/arggon/Projects/ArggonManager-task-web-board-hierarchy-links
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-hierarchy-navigation/task-web-board-hierarchy-links.md
  Leaves live only under a story. id is the filename stem: task-web-board-hierarchy-links.
  CLI `arggon create task web-board-hierarchy-links` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board detail drawer: link parent and list children

## Context

Parent story `story-hierarchy-navigation`: the web board's detail drawer (`cli/src/board.ts` ~L1000–1075) shows `parent` as plain text and has no children section. Clicking through the tree is impossible; the only hierarchy surface is the `parent:`/`ancestor:` list filter.

## Acceptance

- [x] The drawer renders the parent as a link that opens the parent's detail, and a children section listing each child's id + status, each opening that child's detail
- [x] Items with no parent / no children render that honestly (no dead links, no missing section confusion)
- [x] Resolution reads the kernel's `parent` edges (no parallel hierarchy); XSS-safe through the existing escape path
- [x] Axe WCAG A/AA scan stays green in `ui-smoke`; keyboard-reachable (links in the existing tab order); `board-parity` tests pin the new rows
- [x] `arggon validate` green; prettier clean; PR opened

## Notes

### 2026-10-11 @arggon-maker

evidence (maker probe + gates, 2026-10-11, commit 3294f22f):

- gates: arggon validate ok (0 warnings, convention v5); prettier clean on all 6 touched files; tsc build+typecheck projects clean; eslint clean on touched cli files; ast-grep structure 5/5
- vitest: board.test.ts + board-parity.test.ts 122/122 green; board-serve.test.ts 28/28 green (incl. new parent/children serve assertions)
- serve probe on temp fixture (top->mid->leaf-a/leaf-b): /api/item leaf-a shows parent {mid,in_progress} + children []; mid shows parent {top,todo} + children [leaf-a todo, leaf-b done]; top shows parent null + children [mid]
- playwright drive (chromium) on served board: leaf-a drawer shows parent link mid-in_progress + children none; clicking parent opens Mid with both child links; clicking leaf-b opens Leaf B; Esc returns focus to leaf-a card; zero img nodes in drawer
- e2e: 5/5 drawer+axe specs green (ready-board, lens, static-export, static-details drawer incl. drawer axe scan, serve drawer); no new axe violations, no exclusions
- push: origin feat/task-web-board-hierarchy-links, new branch, exit 0

### handoff 2026-10-11 @arggon-maker — next: Review 3294f22f + browser re-drive, then merge and flip done

- branch: feat/task-web-board-hierarchy-links
- open questions: none open; e2e needed a worktree build (dist absent) before running

### 2026-10-11 @ses_ed2ed434cffdHsqB0EV526IjUT

verdict: approve (drawer parent link + children section, UI smoke green)

- Read the worktree diff (board.ts + 3 test files + README + json-output + own item file) — no tui.ts, no plugins/, no templates/; scope stays on the item
- Standards-reviewer: approve, no blocking findings (additive payload from one kernel-edge index, XSS-safe anchors, focus-trap/Esc preserved, no axe exclusions)
- Verifier, all 6 probes green in the worktree: validate ok, prettier clean, build exit 0, vitest 122/122 + 28/28, serve spot-check exact (leaf-a→mid/[], mid→top/[leaf-a,leaf-b], top→null/[mid]), playwright @smoke 33/33 incl. axe gate
- Recommendation: open PR (merge, not squash), merge on green CI; lead ticks Acceptance after merge and flips done
