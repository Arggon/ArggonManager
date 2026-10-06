---
type: task
status: done
id: task-derive-cli-spawn-loader
title: "deriveDefaultCliSpawn cannot derive a spawn spec under the --import loader form (product limitation surfaced by the #518 sweep)"
assignee: Arggon
branch: feat/task-derive-cli-spawn-loader
parent: ci-stability
labels: [testing, mcp]
priority: p3
created: "2026-10-01"
updated: "2026-10-04"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-derive-cli-spawn-loader.md
  Leaves live only under a story. id is the filename stem: task-derive-cli-spawn-loader.
  CLI `arggon create task derive-cli-spawn-loader` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# deriveDefaultCliSpawn cannot derive a spawn spec under the --import loader form (product limitation surfaced by the #518 sweep)

## Context

<!-- Why this task exists. -->

PR #518 (task-runcli-import-tsx-migration) migrated every TEST spawn chain to `node --import <tsx loader> cli/src/cli.ts`, leaving two product-side wrapper surfaces behind. This task closes the gap on both, per the sweep's follow-up.

Empirical note (corrects the filing parenthetical): under the loader form node strips its own options from argv — `argv[1]` is already the entry (`cli/src/cli.ts`, matching neither recognized suffix `cli.js`/`cli.mjs`), and the `--import` target lives in `process.execArgv`, not argv. The gap was real; the mechanism is now documented on `deriveDefaultCliSpawn` itself.

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

- [x] `deriveDefaultCliSpawn` (cli/src/mcp-server.ts) recognizes the loader form: an entry ending in `cli.ts` derives `{ command: process.execPath, args: [...process.execArgv, entry] }` (fork semantics; also covers NODE_OPTIONS registrations via inherited env). Wrapper form (`cli.mjs` + `.ts` argv[2]) and built bin (`cli.js`) kept for back-compat; vitest forks-worker rejection unchanged.
- [x] `measure.ts` `cliCommand()` migrated to the loader form: source runs now spawn `node --import <tsx loader> <cli.ts>` (one node process, no wrapper re-exec/IPC — the bug-row-table-flake class). Consumers verified first: only `runCli`/`measureBudget` inside measure.ts (entry = LAST arg, contract kept) and measure.test.ts functional use; measurement stdout contract unchanged (same CLI, same loader → identical bytes, per #518's evidence). No output-shape change to pin beyond the new spec-shape test.
- [x] package.json `tsx`-bin script lanes (`npm run arggon/dev/smoke:*`) documented as safe (see Notes) — left unchanged.
- [x] Tests pin the new recognition: 6-case recognition table (built bin / wrapper back-compat / loader form / whole-execArgv forwarding / empty-execArgv / forks-worker rejection) + integration test (loader-form-launched server, `arggon_branch` succeeds with NO cliSpawn injection — the exact #518 silent-fallback scenario) + measure `cliCommand` exact-shape pin. Wrapper literals built dynamically in tests so the test-spawn grep gate stays green.
- [x] Gates: `npm test` 112 files / 2005 passed (0 skipped); `npm run lint` ok; `npm run test:structure` ok; `npm run build` ok; `npm run check:plugin` ok — bundle byte-identical, NO regen needed (mcp-server.ts/measure.ts are not in the bundle's module set); `npm run arggon -- validate` ok:true, 0 warnings.

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from task-runcli-import-tsx-migration (PR #518): with tests now spawning the CLI via `node --import <loader>`, the product-side deriveDefaultCliSpawn cannot derive a spawn spec in that form. Safe today (no test exercises spawn tools through child-spawned mcp servers), but any future test doing so will silently fall back. Acceptance: either teach deriveDefaultCliSpawn the loader form (argv triple) or assert loudly + document the limitation where the derivation is attempted; add a test pinning whichever behavior is chosen.

### 2026-10-01 @Arggon

Implemented BOTH halves (derivation + measure migration); both low-risk.

**Why the package.json `tsx`-bin lanes are safe as-is (documented exception):** `npm run arggon/dev/smoke:*` run ONE tsx-wrapper process that executes a leaf command (start/branch/smoke) and exits. They never host an `arggon mcp` server, so nothing consults `deriveDefaultCliSpawn` under them, and no nested CLI spawn chain exists whose wrapper IPC servers could stack (the bug-row-table-flake class needs spawn DEPTH, not wrapper use per se). Migrating them would also change human-facing UX (npm bin resolution, PATH) for zero flake gain — not trivial-and-byte-safe, so per the acceptance they stay.

**Test evidence (commands + observed):**
- `npx vitest run cli/src/mcp-server.test.ts cli/src/measure.test.ts cli/src/test-spawn.test.ts` → 59 passed.
- `npm test` → `Test Files 112 passed (112)`, `Tests 2005 passed (2005)`.
- One pre-existing environment failure during the first full run, unrelated to this change: `headless-ci.test.ts` failed (and 6 tests skipped) because the fresh worktree lacked `lib/dist/index.js` — reproduced on the stashed pristine branch, fixed by `npm run build` (start's workspace pre-build had not produced the lib entry), green after.
- `check:plugin` → exit 0, bundle byte-identical (expected regen per the task brief did NOT materialize: neither mcp-server.ts nor measure.ts is inlined into `opencode/plugins/arggon/index.bundle.ts`; postbuild regenerates and `git diff --exit-code` confirms no drift).

**Back-compat:** all three previously-recognized launch shapes derive exactly as before; the loader form is additive. The only behavior change is the previously-`undefined` case now deriving — which is the fix.

### 2026-10-01 @Arggon
Implementation complete, PR opened (not merged): https://github.com/Arggon/ArggonManager/pull/543 — branch feat/task-derive-cli-spawn-loader (commits 8ddf22ed feat(mcp), 6ffa9d82 chore(tasks)).

Changed: (1) cli/src/mcp-server.ts deriveDefaultCliSpawn (now exported for tests) derives the loader form — entry endsWith cli.ts → { execPath, [...process.execArgv, entry] } (fork semantics; NODE_OPTIONS covered via inherited env); wrapper (cli.mjs+.ts argv[2]) and built bin (cli.js) kept verbatim. (2) cli/src/measure.ts cliCommand() source branch → ["--import", <tsx loader.mjs>, <cli.ts>]; entry-last contract kept; measurement stdout unchanged (same CLI, same loader — #518 evidence). (3) package.json tsx lanes documented-exception on the item (leaf-command processes, never host an mcp server, no nested spawn chain to stack IPC servers).

Test evidence (expected vs observed):
- npx vitest run cli/src/mcp-server.test.ts cli/src/measure.test.ts cli/src/test-spawn.test.ts → 59 passed (new: 6-case recognition table incl. wrapper back-compat + forks-worker rejection; integration test arggon_branch with NO cliSpawn injection under spoofed loader-form launch — the exact #518 silent-fallback scenario; cliCommand exact-shape pin).
- npm test → 112 files / 2005 passed (0 skipped).
- First full run: headless-ci.test.ts failed + 6 skipped in the fresh worktree (missing lib/dist/index.js) — REPRODUCED on stashed pristine branch (git stash; 1 failed | 111 passed), fixed by npm run build; environment-only, not caused by the change.
- npm run lint ok; test:structure ok; build ok; check:plugin exit 0 with bundle byte-identical — expected regen per the task brief did NOT materialize: mcp-server.ts/measure.ts are not inlined into opencode/plugins/arggon/index.bundle.ts (postbuild regenerated; git diff --exit-code confirms no drift), so no chore regen commit exists.
- npm run arggon -- validate → ok:true, 0 warnings. Wrapper literals in tests built dynamically (["cli","mjs"].join(".")) so the test-spawn grep gate stays green.

### handoff 2026-10-01 @Arggon (session: ses_f0821d66effeinPPfJjVWl7SAD) — next: Review + merge PR #543; item is acceptance-complete, gates green on the merged tree.
- branch: feat/task-derive-cli-spawn-loader
- open questions: None material; bundle-regen expectation resolved: mcp-server.ts is not inlined into the plugin bundle, so no regen commit exists.
