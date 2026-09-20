---
type: bug
status: done
id: bug-validate-stdout-injection
title: "Validation/spec human output injection + dynamic warning channels (validate stdout, tracker-commit, issue-roundtrip)"
assignee: Arggon
branch: fix/bug-validate-stdout-injection
parent: opencode2-hardening
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-19"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/bug-validate-stdout-injection.md
  Leaves live only under a story. id is the filename stem: bug-validate-stdout-injection.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Validation/spec human output injection + dynamic warning channels (validate stdout, tracker-commit, issue-roundtrip)

## Context

Findings M1/L2/L1 from the independent review of PR #343
(`bug-cli-error-output-injection`), which sanitized the `arggon <cmd>:` stderr
channel. The same threat class remains on adjacent channels, verified unchanged
by that PR:

- **M1 — validation/spec stdout lines are raw.** `cli/src/validate.ts:386-403`
  (`formatValidateHuman`), `cli/src/spec.ts:327-344`
  (`formatSpecValidateHuman`), `cli/src/spec.ts:607-616`
  (`formatSpecAnalyzeHuman`). Repro with an item/spec whose filename carries
  `\nspoof:` + ESC/C1/DEL/LS/PS: `arggon validate` (exit 1) prints a forged
  column-0 line and raw controls on stdout; same for `spec validate` and
  `spec analyze`. Byte-identical before/after #343 (no regression, unfixed).
- **L2 — dynamic `arggon: warning:` channels.** `cli/src/tracker-commit.ts:142-146`
  (`warnGitSkip`, `skipReason` built from git stderr/stdout first lines) and
  `cli/src/update.ts:735-740` (`issueRoundtrip.skipped`, gh message). Both can
  embed repo-controlled values; unaudited by the #343 audit.
- **L1 — doc bound wording.** `docs/json-output.md:186` says a rendered value
  "can reach 6 × (200 + 1) = 1206"; the true worst case is `6 × 200 + 1 = 1201`
  (the ellipsis is appended after the cut). Fix the wording (or state 1206 as
  the conservative bound).

## Acceptance

- [x] `validate` / `spec validate` / `spec analyze` human output sanitizes
      repo-controlled values (reuse `cli/src/sanitize.ts`); the hostile-filename
      repro renders inert on stdout; exit codes and `--json` unchanged.
- [x] `warnGitSkip` / `issueRoundtrip.skipped` dynamic messages sanitized (or a
      recorded decision with rationale).
- [x] `docs/json-output.md` bound wording corrected.
- [x] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Same hygiene family as `bug-doctor-human-output-injection` → this item; each
  round is one channel further out.

### 2026-09-18 @Arggon
Evidence — M1/L2/L1 implementation (worker handoff; draft PR pending review)

**M1 — `validate` / `spec validate` / `spec analyze` human stdout.**
Fix: each dynamic field (issue `path`/`message`, finding `file`/`message`) goes through `cli/src/sanitize.ts` (`sanitizeHumanError`) inside the formatter; `spec analyze --baseline` lives in the same `spec.ts` family and is sanitized too. Static enums/`[CODE]`/summary lines untouched; `--json` paths keep raw values byte for byte.

Hostile fixture: `tasks/bad\nspoof: fake item<ESC>[31m<U+0085><DEL><U+2028><U+2029>.md` with `status: bogus` (+ the same hostile name as a spec under `docs/specs/`), captured with `cat -v`:

- BEFORE `arggon validate` (exit 1) — forged column-0 line + raw ESC/C1/DEL/LS/PS:
  `error tasks/bad` / `spoof: fake item^[[31mM-BM-^E^?M-bM-^@-(M-bM-^@-).md: unknown status 'bogus' [UNKNOWN_STATUS]`
  `arggon validate: failed with 1 error(s), 0 warning(s)`
- AFTER `arggon validate` (exit 1) — one inert physical line:
  `error tasks/bad\nspoof: fake item\u001b[31m\u0085\u007f\u2028\u2029.md: unknown status 'bogus' [UNKNOWN_STATUS]`
  `arggon validate: failed with 1 error(s), 0 warning(s)`
- `spec validate`: same before→after shape (5 error lines, each inert now); exit 1 both sides.
- `spec analyze`: 2 findings, each inert now; exit 0 both sides (findings never fail the run).
- `--json` for all three: byte-identical before/after (diff empty), parses, raw path with real newline/ESC preserved, exit codes unchanged (1/1/0).
- Ordinary output: `arggon validate`, `spec validate`, `spec analyze` on this repo byte-identical before/after (diff empty); exact-byte assertions added for the `fixtures/tasks-invalid/bad-status` error line, a clean spec fixture, and the clean summary lines.

**L2 — dynamic `arggon: warning:` channels: sanitized (decision recorded).**
- `warnGitSkip` (`tracker-commit.ts`) and the `issueRoundtrip.skipped` stderr warning (`update.ts`) now run through `sanitizeHumanError`. Decision: the dynamic text is external-tool output (git first line / gh failure message) that routinely embeds a path or a full command — the 2000-char composite-diagnostic cap used by the CLI failure channel is the right fit ("a git first line routinely carries a path, which the 200-char report cap could cut"); escaping is the security property and is identical to the report sanitizer. JSON keeps raw (`commit.skipped`, `issueRoundtrip.skipped`).
- Same value on the human stdout twin channels is sanitized too: `formatCommitLine` (`no-commit: <skipReason>`, many commands) and the `arggon update` stdout lines (`issue round-trip: closed ... in <repo>` / `issue round-trip skipped: <skipped>`); otherwise the identical hostile bytes would render raw one line above the fixed warning.
- The 3 static init warnings (`NOT_A_REPO_WARNING` in init) are untouched, as scoped.

**L1 — doc bound wording.** `docs/json-output.md` now states the true worst case `6 × 200 + 1` = 1201 (only the clipped 200 chars can expand; the `…` is appended after the cut and is never escaped) and explicitly notes 1206 as the conservative bound that counts the ellipsis as expandable. Also documented the new validate/spec display-sanitization policy in their sections.

**Tests (new, 13).** `validate.test.ts` +3 (CLI hostile repro inert + exit 1, `--json` raw/valid, ordinary error-line byte-identity); `spec.test.ts` +5 (spec validate/analyze hostile repro inert + exit codes, `--json` raw/valid, clean-fixture byte-identity); `spec-baseline.test.ts` +1 (hostile `--baseline` findings inert); `tracker-commit.test.ts` +2 (hostile skip reason unit + mocked-git integration: warn + `formatCommitLine` inert, payload raw); `issue-roundtrip.test.ts` +2 (hostile injected gh failure warning inert + payload raw; full CLI e2e with a hostile origin slug + failing fake `gh`: stdout+stderr inert, flip succeeds).

**Gates.** `npm test` 73 files / 1203 tests green; `npm run lint` clean; `npm run build` clean; `npm run arggon -- validate --json` ok (0/0) and `spec validate --json` ok. Diff is clean of formatter churn; no files outside validate/spec/tracker-commit/update/cli(display-only)/their tests/docs touched.

**Observation for a future round (not filed here).** Remaining success-stdout dynamic values (e.g. `arggon update`'s `result.path`/`movedFrom`/`renamedFrom`, other commands' path/status lines) are still raw; this item fixed the channels it names (validate/spec stdout + the two dynamic warning channels + their stdout twins).

### 2026-09-18 @Arggon
### handoff 2026-09-18 @Arggon — next: Review draft PR #348 (https://github.com/Arggon/ArggonManager/pull/348) against opencode2; file any findings as follow-ups; coordinator/reviewer merges and flips status (worker does not merge or flip).
- branch: fix/bug-validate-stdout-injection (origin/opencode2 merged before push; full suite re-run green on the merged tree)
- deliverables: M1 (validate / spec validate / spec analyze + spec analyze --baseline human output sanitized via cli/src/sanitize.ts; hostile-filename repro inert; exit codes and --json unchanged), L2 (warnGitSkip + issueRoundtrip.skipped warnings sanitized with the composite-diagnostic cap 2000; stdout twins formatCommitLine and the update round-trip lines sanitized too; 3 static init warnings untouched), L1 (docs/json-output.md true bound 6 × 200 + 1 = 1201 with 1206 noted as the conservative bound)
- gates: 73 files / 1203 tests green, lint clean, build clean, repo validate + spec validate ok
- open questions: none blocking. One observation recorded in the evidence comment: remaining success-stdout dynamic values (e.g. `arggon update` result.path/movedFrom/renamedFrom, other commands' path/status lines) are still raw — the next channel in this hygiene family, not part of this item's acceptance.

### 2026-09-18 @Arggon
Review fix round for PR #348 (verdict NO-MERGE: F1 HIGH + F3 nit). Commit `1847e64`.

- **F1 (HIGH, fixed).** `formatSpecBaselineCompareHuman` (`cli/src/spec.ts`) sanitized `file`/`message` on the `resolved` branch but interpolated the committed snapshot's `severity`/`kind`/`line` raw. Fix: `severity`/`kind`/`file`/`message` all go through `sanitizeHumanError` (both `added` and `resolved`), and `line` renders only when `typeof f.line === "number"` — a non-numeric hostile line is dropped, never interpolated. `readBaselineSnapshot` additionally shape-checks every finding in one bounded pass (string `file`/`kind`/`severity`/`message`; `line` intentionally left to the display-time guard) and throws `malformed finding` otherwise.
- **F3 (nit, fixed).** `npx prettier -w cli/src/validate.ts` collapsed the flagged `lines.push(...)` wrap; `npx prettier --check cli/src/validate.ts` clean. No other churn.
- **F2 (out of scope here).** Baseline argv paths echoed raw remain → `task-success-stdout-sanitize` (filed on opencode2).
- Regression test (new e2e in `spec-baseline.test.ts`, +1 test): hostile snapshot with `severity:"warn<ESC>[31m…"`, `kind:"kind\nspoof…"`, `line:"1\nspoof…"` → human output is one inert line per finding (no raw ESC/C1/DEL/LS/PS, no forged column-0 line, expected line count 3), exit 0; `--json` `baseline.resolved` stays byte-raw (`toEqual`). Extended the invalid-baseline test with a malformed finding (`file: 1`) → `malformed finding`. Verified the new test fails on the pre-fix formatter with raw `\u001b` in the rendered `resolved` line and passes after.
- Gates on the fix commit: `npm test` 73 files / 1204 tests green; `npm run lint` clean; `npm run build` clean; `arggon validate` ok (0 warnings, convention v3); `spec validate` ok (16 docs, 0 warnings); `prettier --check cli/src/validate.ts` clean; new spec.ts hunks prettier-clean (base spec.ts non-conformance pre-existing).

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict NO-MERGE→fixed (1847e64: severity/kind sanitized on both branches, line rendered only when numeric, bounded snapshot shape guard, hostile-snapshot regression that fails pre-fix; prettier hunk clean). Coordinator re-check: spec.ts sanitizer present on all formatter branches + isBaselineFinding guard; focused tests 11/11; full suite 1204 with private TMPDIR; CI cli pass. Merged. F2 (argv baseline paths) tracked in task-success-stdout-sanitize. Closing.
