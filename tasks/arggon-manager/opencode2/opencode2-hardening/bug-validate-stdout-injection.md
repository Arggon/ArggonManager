---
type: bug
status: todo
id: bug-validate-stdout-injection
title: "Validation/spec human output injection + dynamic warning channels (validate stdout, tracker-commit, issue-roundtrip)"
priority: p2
parent: opencode2-hardening
labels: []
created: "2026-09-18"
updated: "2026-09-18"
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

- [ ] `validate` / `spec validate` / `spec analyze` human output sanitizes
      repo-controlled values (reuse `cli/src/sanitize.ts`); the hostile-filename
      repro renders inert on stdout; exit codes and `--json` unchanged.
- [ ] `warnGitSkip` / `issueRoundtrip.skipped` dynamic messages sanitized (or a
      recorded decision with rationale).
- [ ] `docs/json-output.md` bound wording corrected.
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Same hygiene family as `bug-doctor-human-output-injection` → this item; each
  round is one channel further out.
