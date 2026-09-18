---
type: task
status: in_progress
id: task-success-stdout-sanitize
title: "Success-path stdout: sanitize remaining dynamic values (update path/movedFrom/renamedFrom, command path lines)"
assignee: Arggon
branch: feat/task-success-stdout-sanitize
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T21:04:03.859Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-success-stdout-sanitize
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-success-stdout-sanitize.md
  Leaves live only under a story. id is the filename stem: task-success-stdout-sanitize.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Success-path stdout: sanitize remaining dynamic values (update path/movedFrom/renamedFrom, command path lines)

## Context

Open note from PR #348 (`bug-validate-stdout-injection`): failure/finding
channels are sanitized, but **success-path** dynamic values are still raw on
human stdout — e.g. `arggon update` prints `result.path` / `movedFrom` /
`renamedFrom`, baseline paths are echoed (`--baseline`/`--save-baseline` argv),
and other commands print path/status lines built from repo-controlled values.
The sanitizer (`cli/src/sanitize.ts`) is already available.

## Acceptance

- [x] Audit success-path human stdout for interpolated repo-controlled values
      (paths, ids, branch names) and sanitize where untrusted or explicitly
      document the boundary with rationale (argv values are operator-controlled;
      decide and record).
- [x] Tests: hostile-named item through `update` (incl. a reparent/rename that
      exercises `movedFrom`/`renamedFrom`) renders inert; ordinary output
      byte-identical; `--json` raw.
- [x] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Final channel of the human-output hygiene chain (doctor report → CLI errors →
  validate/spec stdout → success stdout).

### 2026-09-18 @Arggon
Evidence — audit + implementation (draft PR pending review; no merge, no status flip)

**Audit: success-path human stdout.** Every dynamic interpolation in `cli/src/cli.ts` (and the `spec analyze` baseline lines in `cli/src/spec.ts`) was classified; each repo-controlled / externally-derived / argv-echoed value is now display-sanitized at its print site. JSON is untouched (raw, byte for byte). Covered:

- `create`: id, path. `next`: item id/title, parent-chain display (ids + titles), the whole rationale (embeds ids/titles).
- `update`: id, path, `movedFrom`, `renamedFrom`, cascade-skipped id/sibling, auto-completed ids, high-ancestor id. (`formatCommitLine` and the issue round-trip lines were already sanitized by `bug-validate-stdout-injection`.)
- `priority migrate`: entry id, conflict label, removed labels. `comment`/`handoff`: id, path, author, `--next` text.
- `import-issues`: story id, entry id, **GitHub issue title** (external). `spec new`/`spec import`, `stack explore`, `playbook new`: file/source/spec-id paths.
- `playbook status`/`refresh`: filed/skipped ids, path, version. `branch`/`start`: id, branch, worktree path, post-start hook command, post-start error, PR URL.
- `cleanup`: base branch, entry id/path/reason, pruned id. `board`: output path, serve root/URL.
- `init` / `init --propose` / `--dry-run`: root, convention path, dest/proposal paths, notes, plan reasons, created/updated/backedUp/skipped/restored path lists.
- `sync`: matched/fillable/pending/unmatched/ambiguous/filled ids and PR branch names. `instructions`: source path.
- `spec.ts` baseline: the `--baseline` / `--save-baseline` argv paths (F2 from #348).

**Decisions recorded.**

- **Sanitizer + cap.** All success-path values use `sanitizeHumanError` (same escaping as every prior channel; `MAX_HUMAN_ERROR_CHARS` = 2000 composite-diagnostic cap) rather than `sanitizeHumanText` (200 report-value cap). Rationale: success status lines routinely carry absolute paths and generated sentences — the `next` rationale is ~330 chars and the 200 cap clipped it, breaking ordinary byte-identity. Escaping is the security property; the cap only bounds hostile output. Ordinary values render byte-identical **except** the two characters the shared policy JSON-escapes in place: `"` and `\` (a title `Fix "quoted" \ thing` renders `Fix \"quoted\" \\ thing` on the human line; pinned by a test). `--json` keeps raw.
- **Operator argv path-like values are sanitized anyway** (`--baseline`/`--save-baseline`, board `--out`, playbook `--version`, `--next`): they are operator-controlled, but automation can paste them from repo data, and path-like values are sanitized consistently across the channel. Ordinary paths stay byte-identical.
- **Deliberately left raw.** Static enums/counters; values already sanitized by their producer (`formatCommitLine`, issue round-trip, cleanup failure lines); the 3 static `NOT_A_REPO_WARNING` init warning lines (prior decision).
- **Content boundary.** `instructions` snippet bodies print verbatim doc content for copy/paste (escaping would mangle tabs/newlines) — same class as `show --body`; recorded, not sanitized.
- **Out of this item's file ownership → follow-up filed.** Row/table/report formatters (`list`, `show`, `report`, `adopt`/`adopt --ack`, `playbook status`, `spec audit`, `board --tui`) still interpolate repo values raw: verified `arggon list` renders a hostile title with raw ESC/C1/DEL, and `arggon adopt`/`adopt --ack` render raw ESC/C1/DEL/LS/PS from a hostile `parent:` frontmatter / `x-generated` key (PR #354 review F1; repro in the follow-up item). Filed as `task-row-table-stdout-sanitize` (context + acceptance, extended with adopt). `board` HTML already `escapeHtml`s; `trend` prints only static enums/numbers.

**Hostile evidence (`cat -v`, before = `origin/opencode2`, after = this branch).**

A. `update task-rate-limit --parent story-handbook --no-commit`, item file renamed to `bad\nspoof: fake item<ESC>[31m<C1><DEL><LS><PS>.md` (exercises `movedFrom`):

- BEFORE: `moved from: .../bad` / `spoof: fake item^[[31mM-BM-^E^?M-bM-^@M-(M-bM-^@M-).md` — forged column-0 line + raw ESC/C1/DEL/LS/PS.
- AFTER: `moved from: .../bad\nspoof: fake item\u001b[31m\u0085\u007f\u2028\u2029.md` — one inert line. Exit 0 both sides.

B. `update "task-badfake<LS>item<PS> <ESC>31m<C1><DEL>" --type story --no-commit` (promotion: exercises `renamedFrom`, new id and new path):

- BEFORE: raw ESC/C1/DEL/LS/PS on the header, path and `renamed from id:` lines.
- AFTER: `arggon update: story story-badfake\u2028item\u2029 \u001b31m\u0085\u007f (type, parent, id)`, escaped path, `renamed from id: task-badfake\u2028item\u2029 \u001b31m\u0085\u007f`. Exit 0 both sides.

C. `next` with a hostile item title: BEFORE raw controls; AFTER `arggon next: task-evil — Fake title badfake\u2028item\u2029 \u001b31m\u0085\u007f`.

D. `spec analyze --save-baseline "<dir>/bad\nspoof: fake item<ESC>[31m<C1><DEL><LS><PS>.json"`: BEFORE forged `spoof:` line + raw controls; AFTER `arggon spec analyze: baseline written to <dir>/bad\nspoof: fake item\u001b[31m\u0085\u007f\u2028\u2029.json (0 finding(s) across 1 spec(s))`. Exit 0 both sides. `--baseline` comparison line likewise.

**`--json` raw.** Hostile `update --json` parses and `movedFrom` equals the raw path (real newline + 6 raw control/LS/PS code points); `renamedFrom` and `next` title raw; `spec analyze --baseline --json` `baseline.file` raw.

**Ordinary byte-identity.** Before/after diffs empty for `update` reparent, `next` (including the full ~330-char rationale — proves no cap clipping) and `spec analyze --save-baseline`; exact-byte assertions for update/create/baseline lines in the new tests.

**Tests (new, 12).** `cli/src/success-stdout.test.ts`: 5 `update` (hostile `movedFrom` human + JSON, hostile `renamedFrom` human + JSON, ordinary exact), 4 other (hostile `next` title human + JSON, ordinary long rationale not clipped, ordinary `create` exact, quote/backslash pinning human + JSON), 3 spec baseline (hostile save human + JSON, hostile compare human + JSON, ordinary exact). Verified failing on pre-fix code: the 5 sanitization tests fail on `origin/opencode2`, while the JSON/ordinary tests pass.

**Gates.** `npm test` 74 files / 1230 tests green (private TMPDIR; 1229 at the reviewed head + the F2 pinning test); `npm run lint` clean; `npm run build` clean; `arggon validate --json` ok (0 errors/0 warnings); `arggon spec validate --json` ok. Prettier: both files fail at base too; the branch's changed hunks introduce no new non-conformance beyond base (prettier-format diff line counts equal the raw diff: `cli.ts` 183, `spec.ts` 11).

**Scope.** `cli/src/cli.ts`, `cli/src/spec.ts` (2 baseline formatter lines + doc note), new test file, `docs/json-output.md` (success-path policy line), tracker (this item + the filed follow-up). No changes to `handoff.ts`, `mcp-server.ts`, `start.ts`/`cleanup.ts`, or plugin files.

### handoff 2026-09-18 @Arggon — next: Review draft PR #354 (https://github.com/Arggon/ArggonManager/pull/354) against opencode2; file any findings as follow-ups; coordinator/reviewer merges and flips status (worker does not merge or flip…
- branch: feat/task-success-stdout-sanitize
- open questions: None blocking. Audit decisions are in the evidence comment: sanitizeHumanError (2000 cap) for success values, argv path-like values sanitized anyway, instructions/show-body verbatim-content boundary,…

### 2026-09-18 @Arggon — review pass 1 follow-ups applied (PR #354)

Reviewer verdict: NO-MERGE (soft — tracker/doc fixes only; the code diff is approved). Applied:

- **F1 (left-raw inventory).** `adopt`/`adopt --ack` added to the out-of-ownership inventory above and to `task-row-table-stdout-sanitize` (context + acceptance + title) with the verified repro: a hostile `parent:` on the existing adoption task prints raw ESC/C1/DEL/LS/PS on the `story:` line, a hostile `x-generated` key prints raw on the `--ack` line, exit 0 both.
- **F2 (byte-identity boundary).** The "ordinary values render byte-identical" claim is qualified — `sanitizeHumanError` JSON-escapes `"` and `\` in place — and `cli/src/success-stdout.test.ts` gains a pinning test for `Fix "quoted" \ thing` (human line escaped, `--json` raw).
- **F3 (`list` rationale).** Corrected in `task-row-table-stdout-sanitize`: frontmatter scalars are line-oriented, so a real newline never renders from a parsed title (it lands as a separate frontmatter line or, after a writer round-trip, as the inert literal `\n` text); the verified leak is raw ESC/C1/DEL/LS/PS (LS/PS can still break a line visually).
- **F4 (evidence).** Test count corrected to the actual suite (1229 at the reviewed head; +1 with the F2 pinning test); the prettier claim qualified to "no new non-conformance beyond base" (both files fail at base; prettier-format diff line counts equal the raw diff); success-path policy line added to `docs/json-output.md` beside the failure/doctor/validate/spec channel policies.
