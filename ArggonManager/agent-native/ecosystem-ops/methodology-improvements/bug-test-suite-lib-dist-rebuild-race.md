---
type: bug
status: in_progress
id: bug-test-suite-lib-dist-rebuild-race
title: "`npm test` can fail spuriously: five test files rebuild `lib/dist` while vitest runs files in parallel, so a spawned CLI child imports a half-written kernel module"
assignee: arggon-delivery-lead
branch: fix/bug-test-suite-lib-dist-rebuild-race
parent: methodology-improvements
labels: [tests, ci-blocking, tooling]
priority: p1
created: "2026-10-04"
updated: "2026-10-05"
claimed_at: "2026-10-05T20:33:42.754Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-test-suite-lib-dist-rebuild-race
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-test-suite-lib-dist-rebuild-race.md
  Leaves live only under a story. id is the filename stem: bug-test-suite-lib-dist-rebuild-race.
  CLI `arggon create bug test-suite-lib-dist-rebuild-race` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `npm test` can fail spuriously: five test files rebuild `lib/dist` while vitest runs files in parallel, so a spawned CLI child imports a half-written kernel module

## Context

The flake: a spawned CLI child died inside Node's ESM loader with
`SyntaxError: The requested module './json.js' does not provide an export named 'compactWorkItem'`,
in a lane that had changed nothing relevant. The missing export name varied per
occurrence (`priorityRank`, `loadItems`, `runValidate`, …) because it varied with
which half-written module the child reached first.

**The reader asymmetry is real, and it is half the cause.** Verified by
measurement:

- With `lib/dist` and `dist` moved aside, 284 in-process assertions still passed —
  `vitest.config.ts` aliases `@arggondev/lib` to `lib/src/index.ts`.
- A spawned child does not inherit that alias (`tsx` does not read the vitest
  config): with the same directories absent it died with
  `ERR_MODULE_NOT_FOUND ... node_modules/@arggondev/lib/dist/index.js`, and from
  inside a child `import.meta.resolve("@arggondev/lib")` returns
  `…/lib/dist/index.js`.

**The writer was real too — and npm-version-dependent, which is why a warm local
run could not see it.** An earlier note on this item claimed no suite writes the
shared build any more (the `npm pack` class closed in #580). That correction was
itself wrong, and the suite-wide freeze is what proved it: on CI the freeze
refused a real writer with `TS5033 … lib/dist/*.d.ts: EACCES`. The writer is
`cli/src/headless-ci.test.ts` — `npm pack --ignore-scripts` in the checkout — and
`--ignore-scripts` does **not** stop the root `prepare` on the npm major CI
ships. Measured, same command, same tree:

| npm                | `npm pack --ignore-scripts` in the checkout                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| 10.9.4 (CI)        | runs `> prepare > npm run build`, ~15s: four `tsc` passes rewrite every file of `lib/dist` and `dist` in place |
| 12.0.2 (local dev) | no lifecycle at all, 0.5s                                                                                      |

Neither the flag nor `npm_config_ignore_scripts` (either case) changes npm 10's
behaviour. So on every CI run this lane rebuilt the shared kernel under other
lanes' readers — the filed flake, live — while a developer on npm 12 saw a clean
suite. Cold cache is **not** the variable; the npm major is. Reproduced locally
in ~40s by putting npm 10 first on `PATH`.

**So both halves were needed**: the read was asymmetric (children read the
artifact) _and_ a writer existed that only CI's npm major triggered. Fixing only
the reader would have left the rebuild; fixing only the writer would have left
every spawned child reading a mutable artifact.

## Acceptance

- [x] Reproduced deterministically: a test that runs the build concurrently with a child-CLI
      suite fails on the stale-export shape — `cli/src/kernel-isolation.test.ts` starts a
      writer process that truncates the kernel module, signals, then **holds** it, so the
      outcome depends on the argv and not on timing: the pre-fix argv dies with
      `does not provide an export named 'loadItems'`, the harness argv links fine. Re-run
      after the writer fix and still green (8/8 in that file, in every full run below).
      (`artifactDrift` is not the repro handle: it needs a real rebuild of the _shared_
      artifact, which is what the fix forbids. It is the named failure instead.)
- [x] Fixed by **isolation, not by retry**, both halves, no rerun and no swallowed error:
      **reader** — children spawned through the harness load the kernel **source**
      (`cliNodeArgs` → `test/kernel-source-resolve.mjs`, wired into `runCli`,
      `spawnNodeCli`, `mcp-parity`, `mcp-server`, `config-race`, the e2e board spec);
      **writer** — `cli/src/headless-ci.test.ts` packs a private copy
      (`freshCloneCopy(root, into, withBuild)`, seeded with this checkout's build output so
      the packed bytes are still the ones under test, and made writable because `cpSync`
      preserves the source's read-only mode), and `test/kernel-artifacts.ts` makes
      `lib/dist/` + `dist/` read-only for the run, so any other rebuild fails with EACCES in
      the lane that wrote.
- [x] `cli/src/{lib-build,plugin-copy,pack-contents,start,test-spawn}.test.ts` reviewed for the
      same pattern, and every occurrence fixed rather than the first — plus the ones the
      filed list missed: `config-race`, `mcp-parity`, `mcp-server`, `headless-ci`,
      `prose-format`, `e2e/board.smoke.spec.ts`, `labs/`. The writer turned out to be
      `headless-ci`; `plugin-copy` and `start` never built (`start` injects `runBuild`
      fakes). Zero CLI children on the shared build and zero packs of the checkout remain,
      and `cli/src/test-spawn.test.ts` pins both — including that the seed is a copy, never
      a link. The one documented exemption is `lib-build.test.ts`, which exercises a
      private copy's `dist` on purpose.
- [x] The harness's existing `artifactDrift` diagnostic is promoted to a **named failure** when it
      fires during a suite — `KernelArtifactDriftError`, raised per child (even when the child
      produced a result, which was the silent case) and again from the global teardown with
      `scope: "suite"`; verified end to end that a teardown raise exits the run non-zero with
      the class name and the before/after fingerprint. It is also what **found** the writer:
      the freeze turned a CI-only in-place rebuild into a local, 40-second reproduction.
- [x] `npm test` run **repeatedly** (≥5 consecutive full runs) green — on **npm 10.9.4**, the
      major CI runs, since that is where the writer lived: 5 consecutive full runs, exit 0
      each, `129 passed (129)` / `2692 passed (2692)`. Plus 3 consecutive green on npm 12.0.2,
      a green run from a cold tree (`rm -rf lib/dist dist` → `npm run build` → suite), and
      6 consecutive green runs of the rebuilt lane. Race-class occurrences
      (`does not provide an export named` / `KernelArtifactDriftError` / `EACCES`) across all
      five npm-10 logs: **0**.
- [x] `arggon validate` ok; no snapshot or gate weakened to make the suite pass — `arggon
  validate: ok (0 warning(s), convention v5)`; no snapshot touched. Gates were **added**,
      and the one gate that was wrong was corrected rather than deleted: `test-spawn.test.ts`
      asserted `--ignore-scripts` on the in-repo pack, which does not hold on npm 10 — it
      now pins the pack cwd and the seed, which do. Also disclosed: one line in that file's
      `SpawnHarnessError` case builds its representative argv with `cliNodeArgs` (what a real
      spawn runs); `vitest.config.ts` gained a second `globalSetup`.
- [x] If the correct fix is structural (one build, many suites — e.g. a globalSetup that builds
      once and forbids per-suite rebuilds), prefer that over five local patches — done
      structurally: one shared harness hook (`cliNodeArgs`) covers every child in the repo, one
      shared clone helper (`freshCloneCopy`) owns every build a suite needs, and
      `test/kernel-artifacts.ts` is the "forbid per-suite rebuilds" gate, enforced by mode
      rather than by convention. Verified: a write attempt is refused (`EACCES`) with the bytes
      untouched, the modes are restored on the exit path, and the guard demonstrably still
      fires — reverting only the pack cwd reproduces the PR #647 failure locally in one run.

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

Found while merging PR #638 (a markdown-only diff), whose `cli` job failed with:

```
SyntaxError: The requested module './relations.js' does not provide an export named 'assertParentEdge'
  at lib/dist/create.js:9
artifactDrift: 'before[lib/dist/create.js=…:504686] after[lib/dist/create.js=…:558367]'
```

**The PR is not the cause** — it touched ADR 0020, `docs/claim.md` and tracker files.
The mechanism, confirmed in this repo at 2026-10-04:

- `lib/src/relations.ts:20` **does** export `assertParentEdge`, and a normal build puts it
  in `lib/dist/relations.js` — so the source and the build are correct in isolation.
- **Five test files trigger a rebuild of `lib/dist` during the run**:
  `cli/src/lib-build.test.ts`, `cli/src/plugin-copy.test.ts`, `cli/src/pack-contents.test.ts`,
  `cli/src/start.test.ts`, `cli/src/test-spawn.test.ts`.
- vitest runs test **files in parallel**, and several of them spawn a child CLI that imports
  the built kernel. When a rebuild lands between two writes, a child can observe a
  `lib/dist` whose module graph is momentarily inconsistent — exactly the failure above.
- The harness already reports `artifactDrift` when build outputs change mid-test, so the
  signal exists; it is not yet treated as a failure cause.

**Why this is p1 despite being a test-only bug:** a red `cli` lane that is not caused by the
change under test trains people to re-run instead of read, and every future reviewer has to
spend the diagnosis again. It has now cost two sessions.

## Acceptance

Superseded: the canonical checklist is the one in `## Acceptance` above, kept there because
a ticked box and its evidence belong with the item rather than inside a dated record. The
list as originally filed on 2026-10-04 is preserved verbatim in this file's git history
(`c1e0e339`). What changed since: the filed writer set was **not** empty — one writer
survived #580 (`headless-ci`'s `npm pack`, which rebuilds the shared build on the npm major
CI runs), the reader half was the other cause, and both are now fixed. The unrelated
pre-existing red (`adr-index-parity`, ADR 0023 unindexed) was reported, filed as
`bug-adr-0023-ships-unindexed-blocks-every-pr` and fixed on `main` in `b2da0329`.

### handoff 2026-10-05 @ses_ef23980f2ffepEv8vQ3eD3FnJO (session: ses_ef23980f2ffepEv8vQ3eD3FnJO) — next: Merge review of fadfbd79/cbc55e91/230cd4d1; route bug-adr-index-parity (pre-existing red on main) before re-running the cli lane

- branch: fix/bug-test-suite-lib-dist-rebuild-race
- open questions: Item title says five files rebuild lib/dist; untrue on this branch (closed by #580) - rename or accept?; headless-ci.test.ts:849 twin-init flake not observed in 5 runs

### 2026-10-05 @ses_ef23980f2ffepEv8vQ3eD3FnJO

### 2026-10-05 @maker (arggon-maker)

Maker evidence for the review — commands run, expected vs observed.

**Mechanism, verified by measurement (not by reading).**

- `mv lib/dist /tmp/… && mv dist /tmp/…` then `npx vitest run cli/src/acceptance-parity.test.ts cli/src/board-parity.test.ts` → expected a build-independent in-process suite; observed **284 passed** with both build outputs absent.
- Same state, `npx vitest run cli/src/build-info.test.ts` → expected a child to be build-independent too; observed `ERR_MODULE_NOT_FOUND … node_modules/@arggondev/lib/dist/index.js`, classified by the harness as `child-boot-failed`.
- From inside a child, `import.meta.resolve("@arggondev/lib")` → `…/lib/dist/index.js` without the hook, `…/lib/src/index.ts` with it.

**Correction: the filed writer set does not exist on this branch.** With `chmod -R a-w lib/dist dist`, a full `npm test` passed every suite except one pre-existing unrelated failure — so no test writes those paths. The `npm pack` class was closed by #580; lib-build/pack-contents/headless-ci each build into a private fresh-clone copy. The hazard was the READ side with no writer, one build-under-test away from the flake.

**Fix** — isolation, no retry, no swallowed error:

- reader: `cliNodeArgs()` adds an in-thread `module.registerHooks` resolve hook (feature-detected, `module.register` fallback) so harness children load the kernel SOURCE, like vitest already does in-process. Cost: 10 spawns 1.579s before vs 1.578s after; zero stderr. Wired into `runCli`, `spawnNodeCli`, mcp-parity, mcp-server, config-race, e2e/board.smoke.spec.ts.
- writer: `test/kernel-artifacts.ts` (second globalSetup) makes `lib/dist/` + `dist/` read-only for the run. Observed: a write attempt throws and the bytes are untouched; modes are restored on teardown and on `process.on("exit")`.
- drift promoted: `KernelArtifactDriftError`, per child (even when the child succeeded — the silent case) and from the teardown with `scope: "suite"`. Observed end to end: a teardown raise exits vitest **1** with the class name + before/after fingerprint.

**Deterministic reproduction** (`cli/src/kernel-isolation.test.ts`): a writer process truncates the kernel module, signals, then HOLDS it — outcome depends on argv, not timing. Pre-fix argv → `does not provide an export named 'loadItems'`; harness argv → links, exit 0, empty stderr.

**Gates, all executed:**

- `npm test` ×5 consecutive on cbc55e91: 76.9s / 81.2s / 82.8s / 84.0s / 83.6s. Every run: **the same single failure**, `cli/src/adr-index-parity.test.ts` (0023-ci-wall-clock.md: 0 index rows). Pre-change baseline run: same failure, 84.09s, 2679 passed. Now 2690 passed (+11 new), no new failures. Race-class occurrences across all five logs: **0**.
- `npm run lint` → clean. `npm run test:structure` → 5 passed. `npm run lint:structure` → clean. `npm run build` → ok. `npm run check:plugin` → ok, no bundle drift. `npm run arggon -- validate --json` → `{"ok":true,…,"errors":[],"warnings":[]}`. `npx prettier --check` → clean on every touched file.

**Two things for the lead:**

1. `cli/src/adr-index-parity.test.ts` is red on `origin/main` (`git show origin/main:ArggonManager/docs/adr/README.md | grep -c 0023` → 0; the ADR shipped in 66035a4a). Not fixed here — separate defect, and it blocks every PR's cli lane, not just the three this race blocked.
2. The item title's writer set is untrue on this branch. Correction is recorded in `## Context`; the title is left for you (tracker framing is yours).

**Disclosed non-additive edits:** one line in `test-spawn.test.ts`'s existing SpawnHarnessError case now builds its representative argv with `cliNodeArgs` (what a real spawn runs — not weaker); `vitest.config.ts` gained a second globalSetup; `CONTRIBUTING.md`/`README.md` documented the old resolution and now describe the new one. `measure.test.ts`'s production-shape pin and the `--ignore-scripts` gate are untouched.
