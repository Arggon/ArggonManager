---
type: task
status: done
id: task-board-static-details
title: "Static board export: optional bounded item details (--details)"
assignee: Arggon
branch: feat/task-board-static-details
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p3
created: "2026-09-23"
updated: "2026-09-30"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-static-details
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-static-details.md
  Leaves live only under a story. id is the filename stem: task-board-static-details.
  CLI `arggon create task board-static-details` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Static board export: optional bounded item details (--details)

## Context

<!-- Why this task exists. -->

## Acceptance

## Notes

### 2026-09-23 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`task-board-item-detail` (merged, PR #412) shipped the drawer **serve-only**: the served page fetches `/api/item?id=` through the kernel bounded read (prose clipped to 8 KB, 4 KB per comment, last 3 comments), while the static export stays lean and byte-identical. Consequence: sharing a static `board.html` (the primary artifact for review hand-offs) loses the drawer. The acceptance explicitly allowed the serve-only path with the trade-off documented; this is the opt-in follow-up.

## Acceptance

- [x] Optional `--details` flag on `arggon board` (static) embedding a bounded per-item detail — documented per-item cap (prose bytes) and a measured payload statement on this repo's tracker in README (measured at 368 items: the tracker grew past the 316 the item quoted)
- [x] The static page reuses the serve drawer client with the embedded payload instead of the fetch; works from `file://` with no server; no runtime dependencies
- [x] Without the flag the static export stays byte-identical to today (regression test)
- [x] Tests: unit (embedding/caps/escaping) + an `@smoke` case for the static-with-details export; payload-size evidence in the verdict
- [x] README board section + `ArggonManager/docs/json-output.md` board section updated (flag + payload contract); `cli/README.md` note aligned with `task-ui-docs-refresh`

### 2026-09-30 @Arggon
Evidence (PR #493, branch feat/task-board-static-details):

- Gates: npm test 1846/1846 (2 consecutive full runs), npm run lint, npm run build (lib+cli+e2e typecheck), npm run check:plugin (exit 0 after committing the regenerated bundle — lib/src/show.ts is inlined), arggon validate --json ok:true, npx playwright test --grep @smoke 21/21 (20 pre-existing + 1 new static-with-details case).
- Byte-identity: renderBoardHtml plain == details:false == staticDetails-without-flag (board.test.ts 'keeps the export byte-identical without the flag'); runBoard no-flag == explicit details:false and drawer-free.
- Caps/escaping unit tests: prose clipped <= 8 KiB with prose_truncated:true, acceptance rows from the clipped prose, comment tail = last 3 of 5 with hidden_comments:2, hostile </script> prose embedded as \u003c (parse-back of the embedded BOARD_DETAILS line).
- file:// real-browser evidence: static export of this repo's tracker opened the drawer offline (screenshot /tmp/evidence-static-details-drawer.png); drawer title, deps, acceptance and body render from the embedded snapshot.
- Measured payload on this repo's tracker (368 items, 2026-09-30): page 383,706 -> 2,256,263 bytes; embedded JSON 1,806,619 bytes (~4.9 KiB/item avg); documented in README + ArggonManager/docs/json-output.md (envelope gains details + detailBytes).
- Note: one full npm test run mid-work showed a single show/runShow-related assertion failure that never reproduced on the two consecutive clean full runs before push; treating as environment flake, flagging here for the reviewer.

### handoff 2026-09-30 @Arggon — next: Coordinator: review PR #493 (verify byte-identity tests + measured payload figures); merge with the tracker commits on the branch
- branch: feat/task-board-static-details
- open questions: Static --details moves always refuse offline (by design, same as drag); should the move menu hide on no-endpoint exports? filed here as a note, not an item
