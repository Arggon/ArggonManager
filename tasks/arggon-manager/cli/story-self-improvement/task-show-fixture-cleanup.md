---
type: task
status: done
id: task-show-fixture-cleanup
title: "show.test.ts leaks argon-show-* fixture dirs (no teardown)"
assignee: Arggon
branch: feat/task-show-fixture-cleanup
parent: story-self-improvement
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-show-fixture-cleanup
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/task-show-fixture-cleanup.md
  Leaves live only under a story. id is the filename stem: task-show-fixture-cleanup.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# show.test.ts leaks argon-show-* fixture dirs (no teardown)

## Context

Flagged by the teardown-sweep worker and the CI-flake worker: `cli/src/show.test.ts`
creates `mkdtemp('arggon-show-*')` fixtures with **no teardown at all**, leaking
directories under the shared `/tmp` on every run. Outside the spawn-family scope
of `task-concurrency-test-teardown-sweep`, but the family is now trivial to
close: `cli/src/test-tmp.ts` (`removeFixtureTree`) exists after PR #347.

- **Stale lock file (PR #347 review finding #3).** `cli/src/tracker-commit.test.ts:808`
  (`holdRepoLock`) writes a fake-holder lock and never releases it, leaving one
  `/tmp/.../arggon-lock-*.lock` per run (the sibling at ~:791 releases via a
  detached child). Release it or document the leak with the age-gated cleanup
  as the backstop.

## Acceptance

- [x] `show.test.ts` tracks its temp dirs and removes them (adopt
      `removeFixtureTree`); no `arggon-show-*` leftovers after a run.
- [x] Quick audit: any other `mkdtemp`-creating test without teardown gets the
      same treatment in this PR (list recorded).
- [x] Full suite green; small PR to `opencode2`.

- [x] The tracker-commit fake-holder lock is released (or the documented leak is explicitly accepted), with the audit list updated.
## Notes

- Leaks are harmless individually but accumulate on shared machines (the
  age-gated global teardown is a backstop, not a substitute).

### 2026-09-18 @Arggon
Evidence (worker Arggon, branch `feat/task-show-fixture-cleanup`).

**Leak measurements** — full suite with a private `TMPDIR`, before → after:

| leftover | before (`6f378d6`) | after (fix) |
| --- | --- | --- |
| `arggon-show-*` dirs | 9 | 0 |
| `arggon-lock-*.lock` files | 1 | 0 |
| any other `arggon-*` entry | 0 | 0 |

- before: `TMPDIR=/tmp/opencode/fixture-baseline npx vitest run` → 73 files / 1204 tests passed; 9 `arggon-show-*` dirs and `arggon-lock-8d57dfdd….lock` survived the run.
- after: `TMPDIR=/tmp/opencode/fixture-post npx vitest run` → 73 files / 1204 tests passed; zero `arggon-*` entries survived.

**Changes** (2 files, +24/−3):
- `cli/src/show.test.ts` — aliased `_mkdtempSync` + tracked wrapper (`tmpDirs`); `afterEach` removes via `removeFixtureTree`; assertions untouched.
- `cli/src/tracker-commit.test.ts` — the warned-skip test releases the fake `holdRepoLock` holder in its `finally` (`rmSync(repoLock(dir), { force: true })`); previously one tmpdir lock file per run.

**Audit — `mkdtemp`-creating tests without teardown:** only `cli/src/show.test.ts`. Verified clean:
- `cli/src` (57 other test files): wrapper → tracked `tmpDirs` + `afterEach` `rmSync`/`removeFixtureTree`; or per-test `finally` (`comment-race`, `claim-race`, `config-race`, `atomic`, `atomic-config-writers`).
- `labs/torture.test.ts` — `removeFixtureTree` at every teardown site.
- `opencode/plugins/arggon/index.test.ts` — `rmSync` in `finally` (both sites).
- `skills/arggon-cli/evals/run.mjs` — `rmSync` before exit.
- `smoke/context-report.ts` (`finally`), `smoke/opencode-smoke.ts`, `smoke/opencode-wave.ts` (teardown loops) — clean; unchanged (item scope excludes `smoke/**`).
- `cli/src/measure.ts` (product) — `rmSync` in `finally`.
- Lock-file writers audited: `lock.test.ts` releases/unlinks each lock; `cascade.test.ts` `holdLock` released in `finally`; only `tracker-commit.test.ts:808` leaked.

**Gates** (private `TMPDIR`): `npm run build` ok · `npm run lint` ok · `npm test` 73 files / 1204 tests passed · `arggon validate` ok (0 warnings, convention v3) · `arggon spec validate` ok (16 docs, 0 warnings).

### handoff 2026-09-18 @Arggon — next: Review draft PR #350 (feat/task-show-fixture-cleanup) against the audit + leak evidence; verify gates, merge to opencode2, flip the item. Worker does not merge or flip.
- branch: feat/task-show-fixture-cleanup
- open questions: None blocking; post-merge suite 73 files/1204 tests, 0 arggon-* leftovers; added lines prettier-clean (files already prettier-dirty at HEAD)

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; teardown covers every exit path (afterEach + tracking wrapper incl. throw-in-fixture), the fake-holder lock release is in the right scope and idempotent, and the base-vs-branch reproduction is exact (base: 9 show dirs + 1 lock; branch full suite: 0) with the base suite confirming no third leak; the audit list is complete; 1204 tests + CI pass; merged. Evidence counts refreshed at close; optional two-hop unit case noted as non-blocking. Closing.
