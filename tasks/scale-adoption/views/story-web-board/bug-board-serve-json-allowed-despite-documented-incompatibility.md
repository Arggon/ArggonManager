---
type: bug
status: in_progress
id: bug-board-serve-json-allowed-despite-documented-incompatibility
title: board --serve --json allowed despite documented incompatibility
assignee: Arggon
branch: fix/bug-board-serve-json-allowed-despite-documented-incompatibility
parent: story-web-board
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T15:49:21.629Z"
---
<!--
  Placement (v0): tasks/scale-adoption/views/story-web-board/bug-board-serve-json-allowed-despite-documented-incompatibility.md
  Leaves live only under a story. id is the filename stem: bug-board-serve-json-allowed-despite-documented-incompatibility.
  CLI `arggon create bug board-serve-json-allowed-despite-documented-incompatibility` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# board --serve --json allowed despite documented incompatibility

## Context

Found by the first adversarial audit run (2026-09-14, task-audit-protocol; throwaway temp tree, doc-promise conformance sweep). `skills/arggon-cli/SKILL.md` §Views promises: "`--serve` binds 127.0.0.1 only and is incompatible with `--github`/`--tui`/`--json`." The CLI refuses `--serve --github` and `--serve --tui` (cli/src/board.ts:1523, 1507) but **allows** `--serve --json`: it emits the standard `{ok:true, command:"board", serving:true, url:"http://127.0.0.1:<port>"}` envelope and then serves forever.

Repro (literal):

```
$ arggon board --serve --json
{"ok":true,"schemaVersion":1,"conventionVersion":3,"command":"board","serving":true,"url":"http://127.0.0.1:45887","port":45887}
# ...process keeps running (serving)
```

Either the doc should drop `--json` from the incompatible list (the envelope is arguably a legitimate programmatic server-start API) or the CLI should refuse the combination like the other two. Decide as design, then land doc and/or behavior in one change.

## Acceptance

- [x] SKILL.md `--serve` sentence matches implemented flag-combination behavior (all three names checked)
- [x] If --serve --json stays allowed: behavior documented where --serve is described; if refused: error path covered by a test

## Notes
