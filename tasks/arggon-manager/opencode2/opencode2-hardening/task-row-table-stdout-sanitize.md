---
type: task
status: todo
id: task-row-table-stdout-sanitize
title: "Row/table success stdout: sanitize repo-controlled columns (list, show, report, playbooks status, spec audit, tui)"
parent: opencode2-hardening
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---

<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-row-table-stdout-sanitize.md
  Leaves live only under a story. id is the filename stem: task-row-table-stdout-sanitize.
  CLI `arggon create task row-table-stdout-sanitize` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Row/table success stdout: sanitize repo-controlled columns (list, show, report, playbooks status, spec audit, tui)

## Context

Audit finding from `task-success-stdout-sanitize` (the CLI-entrypoint success
lines and the `spec analyze` baseline argv paths are sanitized there). The
remaining human stdout **formatters** live outside `cli/src/cli.ts` and still
interpolate repo-controlled values raw:

- `arggon list` — `formatListTable` (`cli/src/list.ts`): the `title`/`id`/
  `assignee`/`branch` columns are frontmatter values. A title with a real
  newline forges a column-0 row; ESC/C1/DEL/LS/PS pass through raw.
- `arggon show` — `renderShowText` (`cli/src/show.ts`): frontmatter fields and
  comments (verbatim content view; needs a decision like `instructions`).
- `arggon report` — `formatReportTable` / `formatReportMarkdown`
  (`cli/src/report.ts`): epic/container `id`/`title` and the blocked section
  `blocked_reason` are repo-controlled.
- `arggon playbook status` — `formatPlaybookStatusTable` (`cli/src/playbooks.ts`):
  the `tech` id and `version` come from `docs/playbooks/` filenames/frontmatter.
- `arggon spec audit` — `formatSpecAuditHuman` (`cli/src/spec-audit.ts`):
  finding `files[]` (spec paths) and `sharedTitles[]` (spec titles).
- `arggon board --tui` — `cli/src/tui.ts`: ids/titles rendered into ANSI frames.

Not in scope: `arggon trend` prints only static enums/numbers; the HTML board
already `escapeHtml`s; `arggon instructions` / `show --body` print verbatim doc
content by design (a `cat`-like content contract, not a line-oriented status
channel) — keep them raw but say so in the item that fixes this one.

## Acceptance

- [ ] Each formatter above sanitizes its repo-controlled columns/values with the
      `cli/src/sanitize.ts` policy before interpolation (same policy as
      `task-success-stdout-sanitize`: escape C0/DEL/C1/LS/PS, composite cap for
      free text; ordinary rows/titles byte-identical).
- [ ] Hostile repro per channel: an item/spec/playbook file whose title/path
      carries `\nspoof:` + ESC/C1/DEL/LS/PS renders inert (no forged row, no raw
      control) on the human path; `--json` payloads keep raw values.
- [ ] `show`/`instructions` verbatim-content boundary explicitly recorded (or
      sanitized with a documented reason if the audit says otherwise); TUI
      either sanitizes or records why it cannot.
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Filed by the `task-success-stdout-sanitize` worker (file ownership there was
  `cli/src/cli.ts` + `cli/src/spec.ts` only). Evidence of the raw behavior is in
  that item's audit comment.
- `board.ts` already escapes HTML (`escapeHtml`), so the static board is not part
  of this item.
