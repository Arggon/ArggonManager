---
type: bug
status: in_progress
id: bug-spawn-sync-test-timeout-flake
title: spawnSync e2e tests flake at vitest 5s timeout under load (2nd instance of the class)
assignee: Arggon
parent: story-dogfood-self-host
labels: [p3]
created: "2026-09-16"
updated: "2026-09-17"
claimed_at: "2026-09-17T07:47:32.755Z"
---
# spawnSync e2e tests flake at vitest 5s timeout under load (2nd instance of the class)

## Context

<!-- What went wrong / how to reproduce. -->

Second documented instance of the vitest-5s-timeout flake class (precedent: bug-next-json-test-flakily-exceeds-vitest-5s-timeout, fixed for that one test only). spawnSync-based CLI e2e tests spawn `node + tsx + cli.ts` per invocation (~400ms warm, but seconds on a cold or loaded machine); at vitest's 5s default `testTimeout` they flake when the suite runs in parallel with heavy load (worktree builds, full-suite local runs). Observed 2026-09-16 during the spec-corpus rollout session (all passed on re-run / in isolation; CI unaffected):

- `cli.test.ts > arggon next exits 0 with a friendly message on an empty pool` — timed out at 5s (full local `npm test`).
- `cli.test.ts > arggon report aggregates leaf statuses grouped by epic` — timed out at 5s (same run).
- Earlier same session: `cascade.test.ts > two concurrent sibling done-flips` — transient ENOENT on `/tmp/arggon-lock-*.lock` (different subclass: shared /tmp lock file collision, possibly worth its own look).

Reproduce: run `npm test` while the machine is under parallel load (or repeatedly); intermittent.

## Acceptance

- [ ] Decide + implement the class fix: either a file-level (or per-test) `testTimeout` bump for spawnSync-based e2e tests (e.g. 15-30s), or a shared `runCli` helper that passes an explicit generous timeout, or vitest config `testTimeout` scoped to `cli/**/*.test.ts` — document the choice in the chosen spot
- [ ] The `cascade.test.ts` lock-ENOENT subclass is either fixed (unique lock dir per test / retry) or explicitly declared out of scope with the reason in this body
- [ ] Full suite passes repeatedly (3 consecutive local runs) and CI stays green

## Notes
