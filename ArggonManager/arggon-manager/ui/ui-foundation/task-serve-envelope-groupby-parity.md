---
type: task
status: done
id: task-serve-envelope-groupby-parity
title: board --serve --json omits `groupBy` while the static envelope echoes it — close or document the parity gap (now covers `tree`)
assignee: arggon-delivery-lead
branch: feat/task-serve-envelope-groupby-parity
parent: ui-foundation
labels: [ui, board, json]
created: "2026-10-14"
updated: "2026-10-14"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-serve-envelope-groupby-parity.md
  Leaves live only under a story. id is the filename stem: task-serve-envelope-groupby-parity.
  CLI `arggon create task serve-envelope-groupby-parity` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# board --serve --json omits `groupBy` while the static envelope echoes it — close or document the parity gap (now covers `tree`)

## Context

Pre-existing parity gap surfaced by `task-web-board-hierarchy-view` (PR #814): the static board's `--json` envelope echoes `groupBy` (`{"groupBy":"tree",...}`) while the `--serve` JSON envelope omits it — and the gap now also covers the new `tree` value. The board payload contract is documented in `ArggonManager/docs/json-output.md`; `cli/src/board-parity.test.ts` pins the two envelopes against each other, so the omission is either a documented exception or a hole.

## Acceptance

- [x] Decided and recorded: `--serve` echoes `groupBy` like the static envelope (with the parity test extended) or the omission is deliberate, documented in `json-output.md` and why
- [x] If changed, the envelope addition is additive; static/serve parity suite green
- [x] `arggon validate` green; affected suites green; PR opened

## Notes

### 2026-10-14 @Arggon
### Evidence — completed by the lead after a host tool-runtime outage (maker work preserved)
The maker's session died mid-flight with the work complete and uncommitted; the delivery lead verified and finished from the same worktree. **Decision: additive echo** — `startBoardServer` returns the validated `groupBy`, and the CLI serve envelope echoes it conditionally, exactly like static (absent when the flag is absent). Rationale: `json-output.md`'s board table declares `groupBy` present with `--group-by` and carves out no `--serve` exception (unlike `path`, which explicitly says "absent with `--serve`"), so the omission was a hole against the documented contract.
Files: `cli/src/board-serve.ts`, `cli/src/cli.ts`, `cli/src/board-parity.test.ts` (new end-to-end parity describe over `[undefined, "tree"]`), `cli/src/board-serve.test.ts`, `ArggonManager/docs/json-output.md` (both duplicated copies kept consistent).
Gates: focused board-parity + board-serve 47/47 (lead re-ran); full suite 157 files / 3,429 (maker, pre-outage); build/lint/structure (maker); validate + prettier green (lead). PR #818.

### handoff 2026-10-14 @Arggon — next: Review + merge PR #818; tick the three acceptance rows at merge verification (rows 1-2 true, row 3 true once the PR lands).
- branch: feat/task-serve-envelope-groupby-parity

### 2026-10-14 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-14 (delivery lead)
Merged as 0b467e57 (PR #818); flipped by the lead after ticking the three rows. The serve envelope now echoes the validated `groupBy` conditionally — exactly like the static envelope (absent when the flag is absent) — with the parity test extended over `[undefined, "tree"]` and both duplicated doc copies updated. Completed by the lead from the maker's worktree after its session died to the host tool-runtime outage (the work was complete and uncommitted; focused 47/47 re-run plus validate/prettier green here; the maker's pre-outage full suite 3,429 recorded on the item; CI `cli` + `ui-smoke` green).
