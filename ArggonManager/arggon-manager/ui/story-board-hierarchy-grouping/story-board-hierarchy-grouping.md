---
type: story
status: todo
id: story-board-hierarchy-grouping
title: "Board reads as a hierarchy: tasks and bugs grouped under stories, epics and initiatives"
parent: ui
labels: []
created: "2026-10-14"
updated: "2026-10-14"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-board-hierarchy-grouping/story-board-hierarchy-grouping.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Board reads as a hierarchy: tasks and bugs grouped under stories, epics and initiatives

## Context

Product-owner requirement 2026-10-14: the board should show tasks and bugs **grouped by story, epic and initiative**, so it is easy to read. Today's surfaces:

- Web board (`board --serve` / static export): status columns, with `--group-by story` grouping cards WITHIN each column by parent story (one level); no epic/initiative nesting.
- TUI (`board --tui`): status columns only (`--group-by` is refused with `--tui`).
- OpenCode board panel: already renders the epic/story/leaf tree (`boardTreeLines`) — the intended full ancestry exists there.

The requirement is the full recorded ancestry (initiative → epic → story → leaf) as a readable grouped layout, honestly for partial chains.

## Acceptance

- [x] The web board renders the recorded ancestry (initiative → epic → story → leaf) as a grouped, readable layout the user can select; each level names its container and status, leaves keep id/status/priority
- [x] Partial chains (parentless leaves, orphans, containers with no children) render honestly; the kernel's `parent` edges are the only hierarchy source
- [x] The existing status-column view and the filter lens keep working (no regression); the layout works in the static export and `--serve` alike
- [x] Docs travel (README board section + `ArggonManager/docs/json-output.md` board contract); browser-drive evidence per ADR 0008 with expected-vs-observed
- [x] `arggon validate`, affected suites, `npm test` and CI `ui-smoke` green; prettier clean

## Notes
