---
type: bug
status: todo
id: bug-opencode-smoke-normalize-bracket-namespace
title: OpenCode smoke namespace normalizer misses tools.arggon bracket-access calls
parent: native-redesign
labels: [opencode-seam, smoke, review-followup]
priority: p1
created: "2026-09-28"
updated: "2026-09-28"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-opencode-smoke-normalize-bracket-namespace.md
  Leaves live only under a story. id is the filename stem: bug-opencode-smoke-normalize-bracket-namespace.
  CLI `arggon create bug opencode-smoke-normalize-bracket-namespace` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode smoke namespace normalizer misses tools.arggon bracket-access calls

## Context

PR #421's focused W4 smoke run exposed a harness false failure: the model emitted the valid Code Mode call `tools.arggon["start"]({ ... })`, the tool executed and returned a correct `ok:true` start envelope, but `normalizeNamespace` in `smoke/opencode-smoke.ts` only rewrites `tools["arggon"].x` to dot access. The needle `tools.arggon.start` therefore misses an equally valid bracket-access form and reports a false lifecycle failure. A second reviewer run reproduced the same class with `tools.arggon["update"]` in the invariants script (37/38), where the transcript showed the claim/no-reopen behavior itself fully correct. Because multiple native transcript checks are model-spelling-dependent and the false negative is indistinguishable from a product failure, this is P1 and independent of both the cleanup fix and provider quota.

## Acceptance

- [ ] Normalize `tools.arggon["x"]` and `tools.arggon['x']` to the same canonical dot form already produced for `tools["arggon"].x`.
- [ ] Preserve support for the existing nested/dot access forms and avoid rewriting unrelated bracket access.
- [ ] Add focused unit coverage for double-quoted, single-quoted, and non-matching tool names.
- [ ] Correct the `normalizeNamespace` doc comment that claims every valid namespace spelling is already handled.
- [ ] Replace/rename the misleading `opencode-smoke.test.ts` case (“normalizes every bracket namespace spelling”) that currently asserts the un-normalized result and locks the gap in.
- [ ] Re-run the affected W4 lifecycle smoke with a bounded model-independent fixture or transcript so the normalizer contract is verified without provider quota.
- [ ] Full test, lint, build, `check:plugin`, and validate remain green.

## Notes

Found during PR #421 review smoke; worker evidence is recorded on `bug-native-cleanup-unverified-worktree-removal`.
