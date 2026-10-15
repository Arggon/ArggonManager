---
type: task
status: in_progress
id: task-container-hygiene-check
title: "Report-only check: a terminal container holding an open container (the 2026-10-14 reopen guard)"
assignee: arggon-delivery-lead
branch: feat/task-container-hygiene-check
parent: story-container-rollup
labels: []
created: "2026-10-15"
updated: "2026-10-15"
claimed_at: "2026-10-15T00:03:28.353Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-container-hygiene-check
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-container-rollup/task-container-hygiene-check.md
  Leaves live only under a story. id is the filename stem: task-container-hygiene-check.
  CLI `arggon create task container-hygiene-check` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Report-only check: a terminal container holding an open container (the 2026-10-14 reopen guard)

## Context

The 2026-10-14 reopen (`task-container-status-vs-open-workstreams`) established the practice:
a container holding an unfinished workstream must not stay terminal. The owner corrected five
containers by hand because nothing reports the state — it accumulates silently (15 of 84
containers were terminal with open descendants; 5 held open _stories_). This task adds the
report-only check the brief promised, so the next occurrence is visible instead of surprising
the product owner on the board.

## Acceptance

- [x] `arggon report` carries an additive `hygiene` section (human + `--json`): terminal containers (`done`/`cancelled`) whose subtree contains a non-terminal container (story/epic), with the offenders listed and bounded like the other report caps — report-only, exit 0, no gate and no `validate` change
- [x] Leaves-only follow-ups (an open bug/task under a closed story) are NOT flagged — that is the documented follow-up pattern; only open _containers_ count
- [x] `--json` shape documented in `ArggonManager/docs/json-output.md`; human + JSON parity pinned; a fixture covers: terminal container with an open story → flagged; terminal container with only open leaves → not flagged; open container with an open story → not flagged
- [x] `arggon validate`, the full suite, lint, structure and prettier green

## Notes

- Surface: `arggon report` is the preferred home (tracker-state surface, already runs at wave
  ends); if its shape fights this, `doctor` is the alternative — record the choice.
- Report-only first (the house style): no CI wiring in this task; promoting the check into a
  gate or an automation is a later decision.
- Today's tree should report zero offenders (the five were reopened); the fixture carries the
  positive cases.

## Notes

### 2026-10-15 @Arggon
### Evidence — PR #826 (report-only container hygiene)

Gates (worktree `/home/arggon/Projects/ArggonManager-task-container-hygiene-check`, branch `feat/task-container-hygiene-check`, after `npm run build`):

- `npm run arggon -- validate`: ok (0 warning(s), convention v5)
- focused: `npx vitest run cli/src/report.test.ts` -> 21 passed (7 new hygiene tests + fixture matrix)
- adjacent: `npx vitest run cli/src/mcp-parity.test.ts cli/src/mcp-server.test.ts cli/src/plugin-copy.test.ts cli/src/skill-generated-commands.test.ts` -> 70 passed
- `npm test`: 158 files, 3471 passed
- `npm run lint`: clean
- `npm run test:structure`: 5 passed
- `npx prettier --check` on touched files: all clean

Surface decision: `arggon report` (the preferred home) — the check is a pure derived view of tracker state and the command already runs at wave ends; `doctor` was not needed. Caps: the report had no caps today, so the hygiene lists follow the kernel's bounded-receipt discipline (`MAX_HYGIENE_OFFENDERS` = 10, `MAX_HYGIENE_OPEN_CONTAINERS` = 5) with `offendersTotal`/`openContainersTotal` carrying the full counts; human output shares the caps and overflow markers.

Semantics delivered: offender = terminal container (`done`/`cancelled`) whose subtree holds a non-terminal container (story/epic) at any depth — every terminal container on the open item's chain, not just the deepest; leaves-only follow-ups are NOT flagged; open containers are never offenders; report-only (exit 0 with offenders, no `validate` change, no CI wiring).

Today's tree: `hygiene: clean — no terminal container holds an open container (84 containers checked)`; `--json`: `"hygiene":{"checked":84,"offenders":[],"offendersTotal":0}`.

Fixture sample (positive cases live in `cli/src/report.test.ts`):
`hygiene: 4 offenders (12 containers checked)` with `epic-cancelled (cancelled) -> story-cancelled-open (in_progress)`, `epic-flagged (done) -> story-open (todo)`, `epic-ok (done) -> story-deep-open (todo)`, `init-closed (done) -> story-deep-open (todo)`.

Files: `lib/src/report.ts` (`containerHygiene`, `formatReportHygiene`, markdown `## Hygiene`), `lib/src/operations.ts` (`ReportPayload.hygiene`), `lib/src/index.ts`, `cli/src/cli.ts` (table append), `cli/src/mcp-server.ts` + `opencode/plugins/arggon/index.ts` (descriptions/schema, trimmed to stay inside the ADR 0006 budgets), `cli/src/report.test.ts` (fixture matrix + parity + caps), `ArggonManager/docs/json-output.md` §report, plus the regenerated plugin bundle and re-synced skill copies.

Remaining: standards review, then merge + the `done` flip (delivery lead).

### handoff 2026-10-15 @Arggon — next: Standards review of PR #826; then merge (branch carries tracker auto-commits) and the lead's done flip.
- branch: feat/task-container-hygiene-check
- open questions: Promoting the check into a gate/CI is a later decision (out of scope); caps 10 offenders / 5 open containers per offender follow the MAX_* receipt discipline — revisit if a real tree ever exceeds the…
