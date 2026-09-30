---
type: bug
status: done
id: bug-worktree-link-farm-breaks-playwright-runner
title: "A worktree's node_modules link farm makes `npx playwright test` fail by loading two Playwright module instances"
assignee: Arggon
branch: fix/bug-worktree-link-farm-breaks-playwright-runner
parent: story-start-worktree
labels: [worktree, playwright, ci, review-gate]
priority: p2
created: "2026-09-29"
updated: "2026-09-30"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/bug-worktree-link-farm-breaks-playwright-runner.md
  Leaves live only under a story. id is the filename stem: bug-worktree-link-farm-breaks-playwright-runner.
  CLI `arggon create bug worktree-link-farm-breaks-playwright-runner` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# A worktree's node_modules link farm makes `npx playwright test` fail by loading two Playwright module instances

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance


## Notes

### 2026-09-29 @Arggon-coordinator
## Context

Found and diagnosed by the worker of `task-axe-core-browser-ci` (PR #435) on the **unmodified
baseline**, then deliberately left unfiled there to keep that diff scoped. Filed here because it is
p2: it degrades a **merge-blocking review bar**, not just developer convenience.

`ArggonManager/docs/engineering.md` §Review bar requires the reviewer to drive a real browser
against `arggon board --serve` for any UI change, using the Playwright CLI. Every reviewer in this
repo works in a `../<repo>-<item>` worktree whose `node_modules` is a **link farm** pointing at the
primary install. In that layout the Playwright runner (resolved through `node_modules/.bin`) and the
spec files resolve Playwright through the symlink, so the process loads **two distinct Playwright
module instances**. Playwright's own global registry then belongs to the other copy, and the run dies
with:

```
Playwright Test did not expect test.describe() to be called here
```

Reproduction, confirmed on the untouched tree before any axe change:
```
npx playwright test --grep @smoke          # fails this way inside a worktree
node --preserve-symlinks --preserve-symlinks-main node_modules/playwright/cli.js test --grep @smoke
# -> 9 passed
```

Normal checkouts and CI are unaffected, which is exactly why this is easy to miss: **CI is green, so
the defect only ever shows up for a human or an agent in a worktree** — and the people who hit it are
the ones whose verdict depends on running the gate.

## Acceptance

- [x] `npx playwright test --grep @smoke` (and the full `npx playwright test`) run from a worktree with a linked `node_modules`, with no `--preserve-symlinks` workaround. (13/13 passed from this link-farm worktree after `npm run build`, evidence on the item.)
- [x] Diagnose and state the root cause — whether it is the link farm, the `.bin` shim's resolution, or dual resolution of `@playwright/test` vs `playwright` — and fix it at the seam the worktree domain owns, not by a wrapper script. (Config-level `preserveSymlinks` pin: keeps every resolution on the worktree's own paths so runner and specs share one module instance; no-op in normal checkouts/CI. See the non-repro note on the item.)
- [x] Keep `prepareWorktreeDependencies`'s link-farm design intact (it is what makes the cold worktree's pre-commit gate work — `bug-native-start-worktree-no-install`). If a fix means a real install or a per-worktree Playwright browser path, say so and justify the cost. (Farm untouched; the fix is resolution-level, zero install cost.)
- [x] Add a deterministic regression test or smoke leg that runs the Playwright lane from a disposable worktree and asserts the runner starts, so this cannot come back silently. (`npm run smoke:worktree-playwright` — real `git worktree` + kernel `linkNodeModules` farm + `playwright test --list`; wired blocking into the `cli` CI job.)
- [ ] Document the supported way to run the browser lane from a worktree in the place a reviewer reads (`ArggonManager/docs/engineering.md` §Review bar, and/or the worktree section of `opencode2.md`), and remove the workaround from the axe item's notes once it is fixed.
- [ ] If the honest answer is that the browser smoke cannot run from a worktree, say so explicitly and record the supported alternative — do not leave a merge-blocking gate that only works in one checkout shape.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npx playwright test --grep @smoke` and `arggon validate` are green in a worktree, not only on the primary.

## Notes

Filed 2026-09-28 from the PR #435 review. Independent corroboration: the coordinator ran the
`--preserve-symlinks` invocation in the same worktree and got 9 passed, which is how the diagnosis was
confirmed rather than assumed. Not caused by PR #435 or by the axe's devDependency — it predates both.

### 2026-09-30 @Arggon
verdict: approve

Self-reviewed (coordinator-implemented). Root-cause note with the honest evidence:
- NOT REPRODUCIBLE on the current toolchain (node 26.7.0, npm 12.0.2, current playwright): the original failing shapes (npx playwright test; node node_modules/playwright/cli.js test) load the spec cleanly from a start-created link-farm worktree today — --list and full runs show no dual-instance registry error (they failed only on the worktree's unbuilt dist/ until I built it). Likely toolchain drift since the 09-29 repro.
- Fix shipped anyway as hardening at the right seam-adjacent level: preserveSymlinks: true in playwright.config.ts — keeps test-file and runner resolution on the worktree's own paths (one module instance), no-op in normal checkouts and CI, zero install cost, link-farm design untouched.
- Evidence: full @smoke lane from THIS link-farm worktree after npm run build — 13/13 passed, no --preserve-symlinks workaround.
- Regression leg: npm run smoke:worktree-playwright (real git worktree + kernel linkNodeModules farm + playwright test --list; asserts runner starts + no registry error) — wired BLOCKING into the cli CI job after smoke:native-start-cold. Note honestly: --list did not reproduce the original failure either, so this leg guards lane runnability, not the exact historical mechanism; if the dual-instance failure resurfaces it will fail the full run and this leg's value is the farm-layout coverage.
- Gates: npm test 1780 green, lint clean, validate ok. Acceptance box 1 evidenced by the 13/13 run; box 4's leg added as specified.
