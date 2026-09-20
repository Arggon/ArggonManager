---
type: task
status: done
id: task-row-table-stdout-sanitize
title: "Row/table success stdout: sanitize repo-controlled columns (list, show, report, adopt, playbooks status, spec audit, tui)"
assignee: Arggon
branch: feat/task-row-table-stdout-sanitize
parent: opencode2-hardening
labels: []
created: "2026-09-18"
updated: "2026-09-19"
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

- [x] Each formatter above sanitizes its repo-controlled columns/values with the
      `cli/src/sanitize.ts` policy before interpolation (same policy as
      `task-success-stdout-sanitize`: escape C0/DEL/C1/LS/PS, composite cap for
      free text; ordinary rows/titles byte-identical except `"`/`\`, which the
      shared policy re-escapes).
- [x] Hostile repro per channel: an item/spec/playbook file whose title/path
      carries ESC/C1/DEL/LS/PS renders inert (no raw control, no visually
      broken line) on the human path; `--json` payloads keep raw values.
      Frontmatter scalars are line-oriented, so drive the repro with
      controls + LS/PS, not a real newline (see the `list` note).
- [x] `adopt`/`adopt --ack` covered: the skip-path `storyId` (hostile
      `parent:` frontmatter on the existing adoption task) and the
      `x-generated` `doc.path` values render inert on the human path;
      `--json` keeps raw values. (Review finding F1 on PR #354.)
- [x] `show`/`instructions` verbatim-content boundary explicitly recorded (or
      sanitized with a documented reason if the audit says otherwise); TUI
      either sanitizes or records why it cannot.
- [x] Full suite, lint, `validate`/`spec validate` green; small PR to
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

### 2026-09-18 @Arggon
Evidence + decisions — row/table human stdout sanitized (draft PR pending review; no merge, no status flip)

**Scope implemented.** Every repo-controlled column/value in the human (non-JSON) formatters is now escaped before interpolation, reusing the shared sanitizer module:

- `list` (`formatListTable`): `id`, `assignee`, `branch`, `title` cells (escaped before width math so padding stays aligned; `type`/`status` are enum-narrowed).
- `show` (`renderShowText`): `id`, `title`, `parent`, `assignee`, `branch`, `labels`, `priority`, `depends_on`, `blocked_reason`, `milestone`, `claimed_at`, `worktree`, `path`, plus the reconstructed comment-heading author.
- `report`: `formatReportTable` epic id/title + initiative id + container ids; `formatReportMarkdown` epic/initiative/container id+title, blocked id/storyId/epicId and `blocked_reason`.
- `playbook status` (`formatPlaybookStatusTable`): `id` (frontmatter `playbook_id` or filename stem) and `version` columns (escaped before width math).
- `spec audit` (`formatSpecAuditHuman`): finding `files[]` spec paths and `sharedTitles[]` requirement/scenario titles.
- `board --tui` (`renderTui`): card id/title (`cardLine`) and the Enter footer message (the selected item's file path); the TUI's own frame SGR/clear escapes remain trusted output.
- `adopt` / `adopt --ack` (`formatAdoptReport` / `formatAdoptAckReport`): `taskId`, `storyId` (skip path takes the existing task's `parent:` — PR #354 F1), `taskPath`, `createdContainers`, dry-run inventory `doc.path`, and the `x-generated` key paths in the ack list.

`--json` payloads are untouched (raw, byte for byte); exit codes and column layout are unchanged for ordinary values. `cli/src/cli.ts` adopt print sites needed **no** change: they already delegate to the two adopt formatters, and the JSON branch prints raw.

**Cap decision (deliberate).** Added `sanitizeHumanTextUncapped` to `cli/src/sanitize.ts`: the shared unsafe set (C0/DEL/C1, U+2028/29) escaped **in place, uncapped, and without re-escaping printable `"`/`\`**. Rationale: row/table channels render repository content whose size is already bounded by the on-disk file, and byte-identity for ordinary values is the display contract. `sanitizeHumanText`'s 200-char report cap would clip ordinary long titles/reasons (and `sanitizeHumanError`'s 2000-char cap is a diagnostic-message policy, not a cell policy); JSON-quoting every ordinary `"`/`\` would visibly alter table/markdown/tui output. So ordinary rows/titles are byte-identical **including** quotes and backslashes (stronger than the acceptance's "except `"`/`\`" allowance). Rendering note: without the `JSON.stringify` pass every C0 renders as `\uXXXX` (`\n` → `\u000a`); both are inert one-line text. The TUI additionally clips each line to the terminal width, so a hostile mega-title cannot flood the screen.

**Content-boundary decision (`show`).** `show` field lines are a line-oriented status channel and are sanitized; prose and comment text are the item's CONTENT — a `cat`-like verbatim view, same contract as `show --body` / `arggon instructions` — and stay raw by design. The comment heading is CLI-reconstructed structure, so its repo-controlled author is escaped. Pinned by a test (`records the verbatim-content boundary`). `instructions` stays fully raw (content channel), as recorded by the previous worker.

**Note on file naming.** The formatter is `formatSpecAuditHuman` in `cli/src/spec-audit.ts` (the item's file-ownership line said `cli/src/spec.ts` (audit); `spec.ts` holds `spec analyze`, already covered by the prior item). `spec-audit.ts` was changed, `spec.ts` was not.

**Hostile evidence (`cat -v`, before = `origin/opencode2`, after = this branch; same fixture tree).** All exit 0 both sides.

- `list` with a task whose filename/title/assignee/branch carry `badfake<LS>item<PS> <ESC>31m<C1><DEL>`: BEFORE raw `M-bM-^@M-(...)^[31mM-BM-^E^?` in three columns; AFTER `Fake title badfake\u2028item\u2029 \u001b31m\u0085\u007f` etc., one inert row per item.
- `show task-evil --meta`: BEFORE raw bytes on title/assignee/branch/path lines; AFTER `arggon show: task-evil — Fake title badfake\u2028item\u2029 \u001b31m\u0085\u007f`, escaped path, no raw control.
- `report` + `report --format markdown`: BEFORE raw controls on `epic:`/`##` and blocked lines; AFTER `Epic Auth badfake\u2028item\u2029 \u001b31m\u0085\u007f`, `— Waiting on OAuth badfake…` escaped.
- `playbook status`: BEFORE raw controls in tech/version columns; AFTER `techbadfake\u2028item\u2029 \u001b31m\u0085\u007f` / `v1badfake…`.
- `spec audit`: BEFORE raw controls in the hostile filename and `- Do badfake <ESC>31m<C1><DEL> thing`; AFTER escaped path and `- Do badfake \u001b31m\u0085\u007f thing`.
- `adopt` (skip path, hostile `parent:`): BEFORE `story: story-badfake<LS>item<PS> <ESC>31m<C1><DEL> (existing)` with raw bytes; AFTER `story-badfake\u2028item\u2029 \u001b31m\u0085\u007f (existing)`.
- `adopt --ack` (hostile `x-generated` key + file on disk): BEFORE `badfake<LS>item<PS> <ESC>31m<C1><DEL>.md — sha256:…` raw; AFTER escaped path, same checksum.

**`--json` raw.** Tests assert raw `title`/`assignee`/`branch`/`path` (list/show), raw epic title (report), raw playbook id/version, raw spec `files`/`sharedTitles`, raw `storyId` (adopt skip), raw ack `path`.

**Ordinary byte-identity (cmp before vs after, same tree).** `list`, `show story-a --meta`, `report`, `report --format markdown`, `playbook status`, `spec audit`: all `cmp` IDENTICAL (0-byte diff). Representative sha256: `list` c2843903…, `show` c90c2f88…, `report --markdown` 2b8f0dc4…, `playbook status` 9f4ab2c7…, `spec audit` 7dbe5b1a….

**Pre-fix discrimination check.** Temporarily no-op'ing `sanitizeHumanTextUncapped` (`return value`): 9/9 hostile tests fail while all 9 JSON/ordinary tests pass — the hostile assertions discriminate leaks instead of merely matching escaped output. Restored immediately; evidence generator also shows the pre-fix CLI emitting raw bytes above.

**Tests.** New `cli/src/row-table-stdout.test.ts` (18 tests: hostile + JSON-raw + ordinary exact/byte-identity per channel, TUI unit, show boundary pinning) and 4 new `sanitizeHumanTextUncapped` tests in `cli/src/sanitize.test.ts`. Existing formatter suites unchanged and green (ordinary outputs asserted there are the byte-identity regression net).

**Gates.** `npm test` 75 files / 1260 tests green (private TMPDIR); `npm run lint` clean; `npm run build` clean; `arggon validate` ok (0 warnings); `arggon spec validate` ok (16 docs, 0 warnings).

**Files touched.** `cli/src/sanitize.ts`, `cli/src/{list,show,report,playbooks,spec-audit,tui,adopt}.ts`, `cli/src/sanitize.test.ts`, new `cli/src/row-table-stdout.test.ts`, tracker. Not touched: `handoff.ts`, `opencode/plugins/arggon/**`, `mcp-server.ts`, docs. Out of scope by audit: `trend` (static), HTML board (`escapeHtml`), `instructions`/`show --body` content.

### handoff 2026-09-18 @Arggon — next: Review the draft PR against opencode2 (row/table stdout sanitization: list, show, report, playbook status, spec audit, tui, adopt/adopt --ack); coordinator/reviewer merges and flips status (worker do…
- branch: feat/task-row-table-stdout-sanitize
- open questions: None blocking. Decisions recorded in the evidence comment: uncapped escape-only sanitizer for row/table channels (byte-identity incl. quotes/backslashes, documented cap decision); show prose/comments…

### 2026-09-18 @Arggon
Draft PR #357: https://github.com/Arggon/ArggonManager/pull/357 (base opencode2, draft). Ready for review; per worker contract no merge and no status flip.

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; every claimed formatter sanitized (escaping before width math in list/playbook status; spec-audit's own formatter; TUI clipped; adopt/ack incl. the hostile-parent repro) with before/after raw-byte evidence on 8 channels and 8/8 base leaks, --json raw for 7 checks, ordinary byte-identity INCLUDING quotes/backslashes and a 250-char title (stronger than the allowance), and no-op discrimination (9/9 hostile tests fail). Deliberate waiver recorded: sanitizeHumanTextUncapped is escape-only with NO length bound (threat model is control/line forgery, not volume; a cap would break display byte-identity — a future hard-bound policy would be its own decision). show prose/comments remain the documented verbatim content boundary. Evidence count corrected to 1260. Merged with cli pass. Closing.
