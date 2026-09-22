---
type: story
status: todo
id: ui-web-board-v2
title: "Web board v2: lenses, detail and accessibility"
parent: ui
labels: [viewer, board, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/ui-web-board-v2.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Web board v2: lenses, detail and accessibility

## Context

<!-- Why this story exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`story-web-board` shipped the static HTML board, `--serve` live reload, drag-and-drop through the kernel update path and the PR review overlay. Measured gaps on 2026-09-22 (served board, this repo, 288 items): 0 input/select/button elements (no search or filter), 0 focusable cards (`tabindex`), 1 aria attribute in the whole DOM (the toast), `color-scheme: light` only, body scrollHeight 41,752 px (done column alone 41,662 px / 281 cards), favicon 404 in the console. Status moves are drag-only (HTML5 DnD, which also does not fire on touch), and every tracker change triggers a full `location.reload()` that loses scroll/filter/drawer state.

The CLI already owns the query language (`lib/src/filter.ts`, `list --filter`, `x-views` saved views) — no UI surface consumes it today.

## Acceptance

- [ ] Child tasks/bugs done with their checklists honest
- [ ] The output stays a single self-contained HTML file (no runtime deps, ADR 0002); features degrade gracefully without `--serve`
- [ ] Every change carries unit tests + a Playwright-CLI smoke driven against `arggon board --serve` (ADR 0008)
- [ ] README board section and docs/json-output.md updated in the same PRs
