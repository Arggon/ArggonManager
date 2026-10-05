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

### 2026-10-05 @arggon-delivery-lead
Measured trigger found while grounding exploration-local-validation-pipeline-023 (2026-10-05), offered as a lead — **not** a second report of the same defect, and not a claim about the root cause.

Reproduced on clean `main` in the primary checkout, no branch edits:

1. `npx vitest run` with **no prior build** → `Test Files 1 failed | 128 passed (129)` / `Tests 1 failed | 2691 passed (2692)`, duration 90.24 s. The failing assertion is the twin comparison this item already names: `cli/src/headless-ci.test.ts:857` — `expect(normalize(initA.stdout, twinA)).toBe(normalize(initB.stdout…))`.
2. `npm run build` → exit 0 in 24 s, and `git status --porcelain` afterwards is **empty** (so the committed plugin bundle is in sync; not a bundle-drift effect).
3. `npx vitest run cli/src/headless-ci.test.ts` → `Test Files 1 passed (1)` / `Tests 7 passed (7)` in 18.9 s.

So the divergence this item describes is **reproducible purely from a stale `lib/dist`** — the one twin runs a packed tarball built from fresh source and the other resolves the kernel through the checkout's existing build, and the two `init --json` envelopes then disagree. That is a concrete, cheap reproducer where the item's acceptance list currently only has an open root-cause question.

It also answers one of the item's acceptance bullets — *what keeps this test from failing in CI*: `ci.yml` runs `npm ci` (whose `prepare` lifecycle is `npm run build`) **before** `npm run test`, so both twins start from the same freshly built source. CI is green here because of the **build-before-test ordering**, not because the twin comparison is inherently deterministic.

Two consequences worth folding into the fix:

- The **ordering dependency is written down nowhere a machine reads.** `bug-test-suite-lib-dist-rebuild-race` (now `done`) fixed the parallel *rebuild* race; what remains is that `build` must precede `test`, and only the workflow YAML carries that knowledge.
- This is the second gate today that a local run gets **wrong for a non-real reason** — the other is `smoke:native-start-cold`, filed as `bug-native-start-cold-ci-skips-move-leg`.

Not proposed as a resolution here: the root cause is still the item's to own. `exploration-local-validation-pipeline-023` only records that a local pipeline must treat `build` as a mandatory first lane because omitting it is a measured false red.
