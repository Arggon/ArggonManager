---
type: task
status: done
id: task-board-docs-dedup
title: board envelope docs duplicated between README and docs/json-output.md (drift risk)
assignee: Arggon
branch: feat/task-board-docs-dedup
parent: story-web-board
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/scale-adoption/views/story-web-board/task-board-docs-dedup.md
  Leaves live only under a story. id is the filename stem: task-board-docs-dedup.
  CLI `arggon create task board-docs-dedup` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# board envelope docs duplicated between README and docs/json-output.md (drift risk)

## Context

From the bug-board-serve-json review (PR #153): the board command's envelope
is documented in BOTH README.md and docs/json-output.md; the two copies
already diverged once (README:263 described the one-shot --serve envelope
correctly while docs/json-output.md did not). Duplication is a standing drift
risk for the next board change.

## Acceptance

- [x] Decide and land: single source (one doc references the other) or a docs-parity test that fails when the two envelope descriptions diverge

## Notes

Decision: **Option A — single normative source.** docs/json-output.md is the JSON contract doc, so its `board` section stays the complete, normative envelope reference. README's board section keeps user-facing prose (--serve/--json/--tui behavior, combinability, failure codes) but no longer lists envelope payload keys; it points to docs/json-output.md for the payload contract. Option B (docs-parity test) was rejected: no precedent for docs-parity tests in the repo and the test would be brittle.

Before landing, every board-envelope claim in docs/json-output.md was verified against cli/src/cli.ts (board action) / board.ts / board-serve.ts: `path` absent with `--serve`; `serving/url/port` only with `--serve`; `github/prCount` only with `--github` (not combinable with `--serve`); `groupBy` with `--group-by milestone`; one-shot `--serve --json` envelope while the process keeps serving; `--tui` fails with `BOARD_FAILED` under `--json` or non-TTY stdout. All claims match; no doc corrections needed beyond the dedup pointer.
