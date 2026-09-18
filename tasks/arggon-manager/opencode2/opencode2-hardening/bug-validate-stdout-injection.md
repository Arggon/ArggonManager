---
type: bug
status: in_progress
id: bug-validate-stdout-injection
title: "Validation/spec human output injection + dynamic warning channels (validate stdout, tracker-commit, issue-roundtrip)"
assignee: Arggon
branch: fix/bug-validate-stdout-injection
parent: opencode2-hardening
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T16:42:50.534Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-validate-stdout-injection
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

**Tests (new, 28).** `validate.test.ts` +3 (CLI hostile repro inert + exit 1, `--json` raw/valid, ordinary error-line byte-identity); `spec.test.ts` +5 (spec validate/analyze hostile repro inert + exit codes, `--json` raw/valid, clean-fixture byte-identity); `spec-baseline.test.ts` +1 (hostile `--baseline` findings inert); `tracker-commit.test.ts` +2 (hostile skip reason unit + mocked-git integration: warn + `formatCommitLine` inert, payload raw); `issue-roundtrip.test.ts` +2 (hostile injected gh failure warning inert + payload raw; full CLI e2e with a hostile origin slug + failing fake `gh`: stdout+stderr inert, flip succeeds).

**Gates.** `npm test` 73 files / 1203 tests green; `npm run lint` clean; `npm run build` clean; `npm run arggon -- validate --json` ok (0/0) and `spec validate --json` ok. Diff is clean of formatter churn; no files outside validate/spec/tracker-commit/update/cli(display-only)/their tests/docs touched.

**Observation for a future round (not filed here).** Remaining success-stdout dynamic values (e.g. `arggon update`'s `result.path`/`movedFrom`/`renamedFrom`, other commands' path/status lines) are still raw; this item fixed the channels it names (validate/spec stdout + the two dynamic warning channels + their stdout twins).
