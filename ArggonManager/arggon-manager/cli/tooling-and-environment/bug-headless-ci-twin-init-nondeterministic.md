---
type: bug
status: todo
id: bug-headless-ci-twin-init-nondeterministic
title: Stale `dist/cli.js` in a worktree surfaces as a false parity failure in `cli/src/headless-ci.test.ts` — the twin behaviour is deterministic; the precondition is not reported
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

> **Corrected 2026-10-05 — the original premise below was wrong.** This item was filed believing
> `main` was independently red. **It is not.** `main` is fully green: **129 files / 2692 tests
> passed** on the primary checkout after a full `npm run build`. The original diagnosis — "two
> fresh `init` checkouts of the same source produce different stdout" — is **refuted**.

**The real cause: a stale `dist/cli.js` in the worktree. Not nondeterminism.**

The failing assertion is `cli/src/headless-ci.test.ts:849` — `packed-bin --json envelopes are
byte-identical to the checkout CLI` — which compares the **packed** bin against the **checkout** CLI.
The two envelopes differed in exactly one place: the packed envelope lacked `"reaped":[]` and
`"reapRefused":[]`, fields the source has emitted since the orphan-reaping work landed.

That is a **build-state** difference, not a nondeterministic one. `runPacked` ships whatever
`dist/cli.js` exists, while the checkout CLI runs from `lib/src` via `tsx`. Running only
`npm run build --workspace @arggondev/lib` — which rebuilds `lib/dist` but **not** `dist/cli.js` —
left the packed side stale and the assertion red. Reproduced and re-diagnosed:

| worktree | build run | `headless-ci.test.ts` |
|---|---|---|
| `…-task-zcode-goal-mode` | `build --workspace @arggondev/lib` only | 1 failed / 6 passed |
| `…-task-zcode-goal-mode` | full `npm run build` | **7 passed** |
| primary checkout | full `npm run build` | **7 passed** |

The twin behaviour is deterministic. The *test* is sensitive to build state, and nothing in the run
says so — it surfaces as a parity mismatch, which reads like a product bug. That mis-signal sent
this lead and two makers chasing a defect that does not exist, and it produced the false claim
"main is red" repeated across several item bodies this session.

**Why it still matters.** The lane is green, but the precondition is real, and it is the same class
`bug-test-suite-lib-dist-rebuild-race` addressed — except #647 covered the **library** build, not the
CLI's own `dist/cli.js`. A fresh worktree still ships a `dist/` that can be stale relative to
`lib/src`, and `npm test` reports nothing until a parity assertion trips over it.

## Acceptance

- [ ] The stale-`dist/` precondition is **reported**, not inferred from a parity failure — via
      `doctor`-style state, a skip-with-reason, or an assertion that names "packed bin is stale vs
      checkout CLI" as a cause distinct from "the two envelopes disagree"
- [ ] `npm run build` (not `--workspace @arggondev/lib`) is what the docs, `CONTRIBUTING.md` and any
      maker dispatch prompt say to run after a worktree sync — the partial build is the trap
- [ ] The assertion distinguishes the two failures, so the next occurrence is diagnosable in one
      read instead of a byte-for-byte envelope diff
- [ ] `test/kernel-artifacts.ts` (from #647) considered: it fingerprints `dist/` too, so a stale
      `dist/` is at least detectable — decide whether it should also **refuse to start** on one
- [x] `npm test` green on a clean `main` checkout, with this file included — **met**: 129 files /
      2692 passed
- [x] The original twin-nondeterminism hypothesis tested and **refuted**, with the real cause named

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
