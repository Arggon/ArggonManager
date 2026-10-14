---
type: task
status: todo
id: task-web-board-hierarchy-view
title: "Web board: grouped ancestry view (initiative → epic → story → leaf) in the served board"
parent: story-board-hierarchy-grouping
labels: [ui, board]
created: "2026-10-14"
updated: "2026-10-14"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-board-hierarchy-grouping/task-web-board-hierarchy-view.md
  Leaves live only under a story. id is the filename stem: task-web-board-hierarchy-view.
  CLI `arggon create task web-board-hierarchy-view` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board: grouped ancestry view (initiative → epic → story → leaf) in the served board

## Context

Parent story `story-board-hierarchy-grouping` (PO requirement 2026-10-14). Implementation home: `cli/src/board.ts` (page render, `groupBy` prototype, the `drawer`/lens machinery) + `cli/src/board-serve.ts`; the served page's filter round-trips through the URL hash; `--group-by milestone|story` exists as within-column grouping and its enum is documented in README + the board's `json-output.md` contract. The OpenCode panel's `boardTreeLines` is the reference for a readable ancestry tree. The ZCode `/arggon-board` path serves the same board and should inherit the fix (verify, do not assume).

## Acceptance

- [ ] `arggon board --serve` (and the static export) can render the grouped ancestry view: every leaf under its story, story under epic, epic under initiative, each level carrying id + status; the selection mechanism (a `--group-by` value and/or an in-page control) is decided and recorded
- [ ] The filter lens applies within the view and the `N of M` counts stay honest; the existing `milestone|story` grouping keeps working or is deliberately folded in (decision recorded); `--tui` combination rules stay honest
- [ ] Orphans and partial chains render honestly (no dead links, no silently missing sections); XSS-safe through the existing escape path; axe WCAG A/AA scan green
- [ ] Docs travel: README board section + `ArggonManager/docs/json-output.md` board contract updated additively
- [ ] Browser-drive evidence per ADR 0008 (Playwright CLI or the repo's established UI-smoke path): the view renders, toggling round-trips, the lens filters within it — expected vs observed on the item; if browser tooling is unavailable, say so and use the strongest available gate, never claiming an unrun probe
- [ ] `arggon validate`, affected suites, `npm test`, CI `ui-smoke` green; prettier clean on touched files

## Notes
