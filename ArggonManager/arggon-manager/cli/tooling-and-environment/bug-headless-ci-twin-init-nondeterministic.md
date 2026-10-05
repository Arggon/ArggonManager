---
type: bug
status: todo
id: bug-headless-ci-twin-init-nondeterministic
title: "`cli/src/headless-ci.test.ts` twin-checkout determinism assertion fails on clean `main`: two fresh `init --no-commit` checkouts of the same source produce different stdout"
parent: tooling-and-environment
labels: [tests, ci, determinism]
created: "2026-10-05"
updated: "2026-10-05"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-headless-ci-twin-init-nondeterministic.md
  Leaves live only under a story. id is the filename stem: bug-headless-ci-twin-init-nondeterministic.
  CLI `arggon create bug headless-ci-twin-init-nondeterministic` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `cli/src/headless-ci.test.ts` twin-checkout determinism assertion fails on clean `main`: two fresh `init --no-commit` checkouts of the same source produce different stdout

## Context

Found during delivery-lead merge verification of PR #612
(`fix/bug-mcp-parity-branch-test-json-parse-of-human-stdout`), 2026-10-05.

`npm test` on that branch reported `Test Files 1 failed | 127 passed (128)` /
`Tests 1 failed | 2668 passed (2669)`. The failing assertion is
`cli/src/headless-ci.test.ts:849`:

```ts
const initB = runCheckoutCli(["--json", "init", "--no-commit"], twinB…);
expect(initB.status, initB.stderr).toBe(initA.status);
expect(normalize(initA.stdout, twinA)).toBe(normalize(initB.stdout…));
```

**It is NOT caused by that PR.** Verified, not assumed: the branch does not
touch `cli/src/headless-ci.test.ts` (`git diff --name-only origin/main..HEAD |
grep headless` → empty), and the same test fails identically in the **primary
checkout on clean `origin/main`**: `Test Files 1 failed (1) | Tests 1 failed |
6 passed (7)`.

So `main` is currently red on its own — a latent defect that no gate has been
holding down, consistent with the item's neighbours in this story.

## Acceptance

- [ ] Root-caused: which field(s) of the `init --json` envelope differ between two
      fresh checkouts of the same source (likely a path/timestamp/absolute-dir leak
      that `normalize` does not cover)
- [ ] Fixed at the source (the non-deterministic producer), not by widening
      `normalize` until it stops noticing
- [ ] `npm test` green on a clean `main` checkout, with this file included
- [ ] `cli/src/headless-ci.test.ts` reviewed for other twin comparisons that could
      mask the same class — fix every occurrence, not just the first
- [ ] Recorded whether `main` was red here before (i.e. is CI currently green on
      main?); if CI is green, explain what keeps this test from failing there and
      whether it is load- or ordering-dependent

## Notes
