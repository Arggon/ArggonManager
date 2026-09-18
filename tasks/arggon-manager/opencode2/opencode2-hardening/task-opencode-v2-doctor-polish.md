---
type: task
status: in_progress
id: task-opencode-v2-doctor-polish
title: "Doctor polish: sanitize hint keys + parser regression tests"
assignee: Arggon
branch: feat/task-opencode-v2-doctor-polish
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T14:08:57.624Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode-v2-doctor-polish
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode-v2-doctor-polish.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-doctor-polish.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Doctor polish: sanitize hint keys + parser regression tests

## Context

Non-blocking findings from the independent review of PR #324
(`task-opencode-v2-doctor`), recorded before that PR merged. The review verdict
was MERGE with these minors deferred here.

- **MINOR-1 — terminal-output injection.** `formatOpenCodeLines` joins
  `v1ShapedKeys` (which copy `mcp.<name>` verbatim from an untrusted adopter
  config) into the human `hint:` line with no escaping: keys containing ANSI
  escapes or newlines can spoof lines or emit control sequences in a terminal.
  JSON output is safe (`JSON.stringify` escapes). Repro in the review.
- **MINOR-2 — untested documented invariants.** `mcp.timeout` exclusion (the
  contract in `docs/json-output.md`) and the block-comment/string-aware JSONC
  parsing have no regression tests; both were verified by probe only.
- **MINOR-3 — hand-mirrored candidate list.** `cli/src/doctor.ts` duplicates
  the four config candidates from `cli/src/docs.ts` (`findOpenCodeConfig`).
  Byte-identical today and disclosed; reconcile (export a shared candidate
  list or add a parity assertion) so it cannot drift silently.

## Acceptance

- [x] Untrusted values are sanitized before appearing in human output (JSON
      escaping or an equivalent bounded sanitizer), with a test using a
      config whose key contains an escape/newline; JSON output unchanged.
- [x] Regression tests: `mcp.timeout` present under `mcp` is **not** flagged;
      block comments (`/* */`) and `//`/`/* */` markers inside strings parse
      (one `doctor.test.ts` case each).
- [x] Candidate-list parity: either doctor imports a shared exported list, or
      a test asserts the two lists match; note the intentional difference
      (doctor lists all present configs; the helper returns the first).
- [x] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- The review also nits the PR/item evidence counts that went stale when the CI
  fix added a test (`1057` → `1074`); no code action, fold into this PR's
  description if touched.

### 2026-09-18 @Arggon
### Doctor polish implementation — evidence (task-opencode-v2-doctor-polish)

Implementation commit: `05115d1` on `feat/task-opencode-v2-doctor-polish` (draft PR opened right after this comment). All three PR #324 review minors addressed:

**MINOR-1 — terminal-output injection.** `formatOpenCodeLines` now runs every `v1ShapedKeys` entry through `sanitizeHumanValue` (allowlist `[A-Za-z0-9._-]`; anything else `JSON.stringify`-escaped in one bounded pass) before the human `hint:` line. Fixture with an `mcp.<name>` key containing ESC + newline (`evil\u001b[31m\nspoof: fake hint`):

- human (`doctor | cat -v`): `hint: V1-shaped OpenCode config opencode.json (enabled, "mcp.evil\u001b[31m\nspoof: fake hint") — ...` — no `^[` ESC, no fabricated line; ordinary keys still render bare.
- JSON (`doctor --json`): `keys: ["enabled", "mcp.evil\u001b[31m\nspoof: fake hint"]` — raw key preserved (`raw key preserved exactly: true`).

Regression test asserts both directions: `sanitizes ANSI escapes and newlines in untrusted config keys for human output (MINOR-1)`.

**MINOR-2 — documented invariants pinned** (one case each in `cli/src/doctor.test.ts`):

- `does not flag the documented V2-valid mcp.timeout key (MINOR-2)`
- `parses a block comment (/* */) outside strings (MINOR-2)`
- `parses // and /* */ markers inside string values, not as comments (MINOR-2)`

**MINOR-3 — choice: shared export, not a parity-mirror test.** `OPENCODE_CONFIG_CANDIDATES` is now exported from `cli/src/docs.ts`; `findOpenCodeConfig` and `doctor` both import it. Added a pin test (`scans exactly the shared OPENCODE_CONFIG_CANDIDATES list from docs.ts (MINOR-3 parity)`). The intentional difference is documented on the export: doctor lists ALL present configs; the helper returns the first ADOPTER one (arggon's generated config skipped by signature). `docs/json-output.md` statements remain true — no doc edit.

**Gates** (worktree `../ArggonManager-opencode2-task-opencode-v2-doctor-polish`):

- `npm test`: 69 files, 1132 tests passed
- `npm run lint`: clean
- `npm run build` (tsc): clean
- `arggon validate --json`: ok (0 errors/warnings)
- `arggon spec validate --json`: ok (0 errors/warnings)

### handoff 2026-09-18 @Arggon — next: Review the draft PR; on merge auto-done flips the item (acceptance ticked, tests green). No further code work expected.
- branch: feat/task-opencode-v2-doctor-polish
- open questions: none; docs/json-output.md intentionally unchanged
