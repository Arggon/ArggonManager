---
type: task
status: todo
id: task-opencode-v2-doctor-polish
title: "Doctor polish: sanitize hint keys + parser regression tests"
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
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

- [ ] Untrusted values are sanitized before appearing in human output (JSON
      escaping or an equivalent bounded sanitizer), with a test using a
      config whose key contains an escape/newline; JSON output unchanged.
- [ ] Regression tests: `mcp.timeout` present under `mcp` is **not** flagged;
      block comments (`/* */`) and `//`/`/* */` markers inside strings parse
      (one `doctor.test.ts` case each).
- [ ] Candidate-list parity: either doctor imports a shared exported list, or
      a test asserts the two lists match; note the intentional difference
      (doctor lists all present configs; the helper returns the first).
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- The review also nits the PR/item evidence counts that went stale when the CI
  fix added a test (`1057` → `1074`); no code action, fold into this PR's
  description if touched.
