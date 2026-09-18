---
type: task
status: in_progress
id: task-row-table-stdout-sanitize
title: "Row/table success stdout: sanitize repo-controlled columns (list, show, report, adopt, playbooks status, spec audit, tui)"
assignee: Arggon
branch: feat/task-row-table-stdout-sanitize
parent: opencode2-hardening
labels: []
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T21:57:38.236Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-row-table-stdout-sanitize
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-row-table-stdout-sanitize.md
  Leaves live only under a story. id is the filename stem: task-row-table-stdout-sanitize.
  CLI `arggon create task row-table-stdout-sanitize` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Row/table success stdout: sanitize repo-controlled columns (list, show, report, adopt, playbooks status, spec audit, tui)

## Context

Audit finding from `task-success-stdout-sanitize` (the CLI-entrypoint success
lines and the `spec analyze` baseline argv paths are sanitized there). The
remaining human stdout **formatters** live outside `cli/src/cli.ts` and still
interpolate repo-controlled values raw:

- `arggon list` — `formatListTable` (`cli/src/list.ts`): the `title`/`id`/
  `assignee`/`branch` columns are frontmatter values. Frontmatter scalars are
  line-oriented, so a real newline in a title never reaches the formatter: it
  lands as a separate frontmatter line (a forged unknown key at worst, or a
  parse error), or — after a writer round-trip like `create`/`update` — is
  JSON-escaped to the literal two-character `\n` text, which is inert. The
  verified leak is raw ESC/C1/DEL plus LS/PS (verified: `arggon list` prints
  them raw, exit 0); LS/PS can still break a line visually, which is why they
  are in the escape set.
- `arggon adopt` / `arggon adopt --ack` — `formatAdoptReport` /
  `formatAdoptAckReport` (`cli/src/adopt.ts`): the idempotent skip path takes
  `storyId` from the existing `task-adopt-arggon` item's `parent:` frontmatter,
  and the report prints `taskPath`, the `x-generated` `doc.path` values
  (dry-run inventory / ack list), `createdContainers`, and stack/corpus lines.
  `cli/src/cli.ts` writes both formatters to stdout raw. Verified repro: an
  item whose `parent:` is `story-badfake<LS>item<PS> <ESC>31m<C1><DEL>` →
  `arggon adopt` prints the raw ESC/C1/DEL/LS/PS on the `story:` line, exit 0;
  an `x-generated` key carrying the same bytes with an on-disk file of that
  name → `arggon adopt --ack` prints it raw, exit 0.
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
      free text; ordinary rows/titles byte-identical except `"`/`\`, which the
      shared policy re-escapes).
- [ ] Hostile repro per channel: an item/spec/playbook file whose title/path
      carries ESC/C1/DEL/LS/PS renders inert (no raw control, no visually
      broken line) on the human path; `--json` payloads keep raw values.
      Frontmatter scalars are line-oriented, so drive the repro with
      controls + LS/PS, not a real newline (see the `list` note).
- [ ] `adopt`/`adopt --ack` covered: the skip-path `storyId` (hostile
      `parent:` frontmatter on the existing adoption task) and the
      `x-generated` `doc.path` values render inert on the human path;
      `--json` keeps raw values. (Review finding F1 on PR #354.)
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
- Review follow-up (PR #354 findings F1/F3): `adopt`/`adopt --ack` added to the
  left-raw inventory with the verified repro, and the `list` rationale corrected
  — frontmatter scalars are line-oriented, so the verified leak is raw
  ESC/C1/DEL/LS/PS (LS/PS can still break a line visually), not a real-newline
  forged row.
