---
type: task
status: done
id: task-fast-check-invariant-properties
title: "Add fast-check properties for parser, status, dependency, UTF-8, and worktree invariants"
assignee: Arggon
branch: feat/task-fast-check-invariant-properties
parent: ui-foundation
labels: [testing, property-based, kernel]
priority: p2
created: "2026-09-24"
updated: "2026-09-29"
depends_on: [bug-native-start-worktree-no-install, task-ast-grep-structural-rules]
worktree_path: /home/arggon/Projects/ArggonManager-task-fast-check-invariant-properties
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-fast-check-invariant-properties.md
  Leaves live only under a story. id is the filename stem: task-fast-check-invariant-properties.
  CLI `arggon create task fast-check-invariant-properties` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Add fast-check properties for parser, status, dependency, UTF-8, and worktree invariants

## Context

Add a small, high-confidence `fast-check` property suite for the adversarial kernel surfaces called out by `exploration-open-source-agent-tooling-013`. Properties complement the broad example-based suite; they must use bounded, deterministic seeds/run counts in ordinary CI and must not encode a weaker model than production invariants.

## Acceptance

- [x] Add an exact/dev-only `fast-check` dependency with a small reusable bounded runner or deterministic seed/replay policy for normal CI. — `fast-check` 4.10.2 (dev, exact; one transitive dep) + `test/property-runner.ts`: 25 runs, fixed seed, `endOnFailure`, per-property config log, replay header on failure. `npm run test:property` runs the property files alone.
- [x] Property: valid generated item frontmatter survives parse → serialize → parse without losing required fields or changing unrelated body text. — `lib/src/frontmatter.property.test.ts`; the YAML-ambiguous class the generator's documented domain excludes is covered exhaustively by a pinned canary, and the loss is filed as `bug-frontmatter-ambiguous-plain-scalar-loss`.
- [x] Property: status transitions preserve the legal transition table and terminal `done`/`cancelled` items cannot be reopened by any generated transition sequence. — `lib/src/status.property.test.ts` (seam soundness, terminal absorbing for agents, human reopen only via `todo`, claim guard, table shape, `unclaim`).
- [ ] Property: generated dependency graphs terminate and report the same canonical cycle set regardless of input traversal order. — **WAIVED by the coordinator (`ArggonManager/docs/agents.md` §5.1); NOT met as written.** The worker's own reading, which the coordinator accepts: termination, the order-independent cyclic/acyclic **verdict**, completeness, absence of false positives, and "every reported cycle is real, canonically anchored and deduped" are all asserted unconditionally in `lib/src/validate.property.test.ts`. The **cycle chain text** and, for multi-cycle graphs, the **named cycle set** are not order-independent today — the rotation runs on the cycle array that already contains the closing node — so this box's "report the same canonical cycle set regardless of input traversal order" cannot be asserted green without lying. Both divergences are counted and logged per run and pinned as a canary, so fixing `bug-dependency-cycle-chain-rotation-duplicates-a-node` turns this suite **red on purpose**, which is the intent. Rationale for a waiver rather than a tick: a parenthetical on a ticked box reads as met to the next reader; an explicit waiver does not. The obligation is carried by the filed bug, not by this item.
- [x] Property: bounded UTF-8 detail clipping never splits a code point, respects the byte cap, and preserves valid text for representative multibyte input. — `cli/src/board-serve.property.test.ts` against the real `clipDetailText` (the only byte-capped clipper in the product; the kernel's own bound caps characters). Prefix, byte cap, verdict, maximality, idempotence + the two production caps.
- [x] Property: worktree cleanup/ownership classification remains safe and idempotent for generated link/farm shapes, including foreign installs that must never be removed. — `lib/src/worktree.property.test.ts`: 15 install shapes (absolute/relative/dotted/trailing-slash links, owned and foreign farms, dangling, regular file, reified) plus the cleanup classifier's full fact space.
- [x] Each property has an explicit invariant comment, bounded complexity, a deterministic replay seed on failure, and ordinary example-based tests remain authoritative for concrete contracts. — each file states its invariants in the header; every property logs `N runs, seed … (replay: …)`; failures re-throw with the replay command; the example-based suites are unchanged and still pin the concrete contracts.
- [x] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, and `arggon validate` are green without runtime dependency or production behavior changes; PR evidence includes run counts/seeds and any minimized counterexample. — all green in the worktree (also `lint:structure`, `test:structure`); no runtime dependency, no product behaviour change; PR #433 carries the run counts/seeds, the soak table and both minimized counterexamples. Two build-config lines were needed to make the shared runner reachable (root build no longer compiles `*.test.ts` into `dist/` — already excluded from the tarball — and the lib noEmit typecheck project is rooted one level up).

## Notes

### 2026-09-29 @Arggon
Property suite merged-ready on `feat/task-fast-check-invariant-properties` (PR #433, draft). Two kernel bugs found and filed rather than fixed; both are pinned as canaries so the fixes turn the suite red on purpose.

## Gates (all run in this worktree)

- `npm test` — 103 files, 1701 tests passed, ~63 s
- `npm run lint` — clean · `npm run build` — clean (`dist/cli.js` + `lib/dist`)
- `npm run check:plugin` — clean, no diff to `opencode/plugins/arggon/index.bundle.ts`
- `npm run lint:structure` — ast-grep scan clean · `npm run test:structure` — 3/3 rules
- `npm run arggon -- validate --json` — `ok:true`, 0 warnings
- `npm run test:property` — 5 files / 12 tests / **~0.4 s** added to the suite

## Bounded run policy

`test/property-runner.ts`: **25 runs, fixed seed 20260928** (byte-reproducible CI), `endOnFailure` (no retry loop), one `N runs, seed … (replay: ARGGON_PROPERTY_SEED=… ARGGON_PROPERTY_RUNS=… npm run test:property)` line per property, and a replay header on every failure. Soaks at the same seed: frontmatter 20 000 (5.3 s), status 20 000 (2.7 s), dependencies 4 000 (13.3 s), worktree 5 000 (2.8 s), utf-8 clip 20 000 + 5 000 (0.5 s + 9.2 s) — all green.

## The five properties (invariant, model source, cost)

1. **frontmatter** — a valid item survives parse → serialize → parse: the write is a fixed point, every field reads back through the production accessors, the body is byte-identical. Generator model: the item-file shape `softTryLoadItem` reads, gated by the production validators (`assertValidId`, `assertLabels`, `assertBranchName`, `assertClaimAndBlocked`) run _inside_ the property. 25 runs, ~0.15 s. Free text and id/label tokens contain at least one ASCII letter by construction — a documented domain restriction, because the excluded class (bare YAML null/number tokens) is a real kernel loss, not a property weakness.
2. **status** — every generated transition sequence stays inside the table; `done`/`cancelled` is absorbing for the agent path; a human reopen goes through `todo`; the claim guard holds at every step; `unclaim` only from `in_progress`. Model: `assertUpdateRules` (the seam both surfaces use) driven by the `status.ts` table, sequences built from the CLI's own convention (reason iff blocked, assignee iff claimed). 25 runs, ~0.1 s.
3. **dependency graph** — termination, order-independent cyclic/acyclic verdict, completeness on a constructed ring, zero false positives on a constructed DAG, every reported cycle a real closed walk, canonically anchored and deduped. Model: a valid v5 tracker written through the kernel's own `newItemPath`, dependency edges from `checkDependencies`. 25 runs, ~0.35 s.
4. **utf-8 detail clip** — the result is a whole-code-point prefix, within the byte cap, `truncated` iff the input exceeds it, maximal, and idempotent. Model: the real `clipDetailText` + the two production caps, over 1/2/3/4-byte code points and combining marks. In `cli/src/` because that is the only **byte**-capped clipper in the product (the kernel's `sanitizeHumanValue` and the plugin's `boundedNativeText` cap characters). 25 runs, ~0.1 s.
5. **worktree** — ownership: only what `start` created is removed, second call always false, the primary install never touched (farms hold symlinks _into_ it), foreign installs byte-identical afterwards. Classification: prunable only when every safety predicate holds, every skip carries a reason, foreign paths never removable and never removed, pure/idempotent. 15 install shapes + the full fact space. 25 runs, ~0.2 s.

## Counterexamples minimized, and what they proved

- `bug-frontmatter-ambiguous-plain-scalar-loss` (filed under `story-tracker-hygiene`). Minimized: `parent: 06` → the second write emits `parent: 6`; the same loss on the first read of `arggon create task "0123"` (`show` returns `123`), and `null`/`~` drop the field entirely with `arggon validate` clean. Reaches every value the convention accepts. Minimal fix identified: extend the `formatScalar` force-quote predicate with `/^(?:~|null|true|false|-?\d+)$/`.
- `bug-dependency-cycle-chain-rotation-duplicates-a-node` (filed under `story-deps-schema`). Minimized corpus `[[1,4],[2,6],[6,7],[4,5],[4,6],[3,6],[7,2],[1,7]]`; the same cycle printed as `task-gen-2 -> task-gen-6 -> task-gen-6 -> task-gen-7` and `task-gen-2 -> task-gen-6 -> task-gen-7 -> task-gen-7` — neither a valid chain. Fix: rotate the simple cycle, re-append the anchor, re-key dedup on the member set.

## Deviations the coordinator should weigh

- The cycle acceptance line is only **partially** satisfiable without a production fix: the verdict is order independent (a theorem), but the chain text and the named cycle set are not. The property asserts the order-independent parts unconditionally and measures/pins the rest — annotated on the box in the item body.
- Two build-config lines: the root build project no longer compiles `**/*.test.ts` into `dist/` (the tarball already excluded them, so nothing shipped changes) and the lib noEmit typecheck project is rooted one level up (`rootDir: ".."`). Without them a shared runner in `test/` cannot be imported from both `lib/src` and `cli/src` property files. Flagged in the PR description.
- I could not control the DFS **start** order (it follows the filesystem walk); the deliberate perturbation is the `depends_on` edge-list order plus the file-write order, and the property header says so.

`status: in_progress` left for the coordinator; the two bugs are `todo` under their topical stories.

### handoff 2026-09-29 @Arggon — next: Review and merge draft PR #433; then land bug-dependency-cycle-chain-rotation-duplicates-a-node and bug-frontmatter-ambiguous-plain-scalar-loss and delete their canaries
- branch: feat/task-fast-check-invariant-properties
- open questions: Accept the partial cycle acceptance line, or block on the fix first?;Is the root-tsconfig test exclude in scope for this item?;Should the clip property move to labs/ instead of cli/src?

### 2026-09-29 @Arggon
Review round 1 addressed. One blocking finding (the root `tsconfig.json` exclude deleted the CLI test type gate) plus two questions answered below.

## The blocking finding — fixed, and I found a second instance of it myself

You were right, and the comment was worse than the regression. While verifying I found the same leak hit a **second** gate: `extends` inherits `exclude`, so `labs/tsconfig.json` (documented in `labs/README.md` as a type-check command) silently stopped checking `labs/torture.test.ts` and the CLI tests it covers. Probe: `tsc -p labs/tsconfig.json --noEmit` exit 0 before, exit 2 after.

**Arrangement** — the pattern the repo already uses in `lib` (`lib/tsconfig.typecheck.json`): the build project only emits, a sibling `noEmit` project is the type gate.

| file                            | change                                                                                      | why                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `tsconfig.typecheck.json` (new) | `noEmit`, `rootDir: "."`, `include: ["cli/src/**/*.ts", "test/**/*.ts"]`, **`exclude: []`** | the gate: `test/**/*.ts` puts the shared runner in the program, and `exclude: []` overrides the inherited exclude |
| `package.json`                  | `build` = `… && tsc -p tsconfig.json && tsc -p tsconfig.typecheck.json`                     | mirrors `lib`'s build script, so CI keeps the gate                                                                |
| `labs/tsconfig.json`            | added `exclude: []`                                                                         | un-disarms the lab project that the inherited exclude silently disarmed                                           |
| `tsconfig.json`                 | comment rewritten, exclude kept                                                             | the comment now states what is true and names `tsconfig.typecheck.json`                                           |

I chose the sibling project over wiring `labs` in because `labs` is dormant (no script), is documented as a _manual_ command, and does not cover `test/**`; the sibling is what `npm run build` can depend on.

## A/B proof (probe: `const n: number = "definitely not a number"` in a `cli/src` test)

| tree / project                       | command                                  | exit | catches?            |
| ------------------------------------ | ---------------------------------------- | ---- | ------------------- |
| `main` build project (no exclude)    | `npx tsc -p tsconfig.json`               | 2    | yes, `error TS2322` |
| this branch, build project (emitter) | `npx tsc -p tsconfig.json`               | 0    | no, **by design**   |
| this branch, sibling noEmit project  | `npx tsc -p tsconfig.typecheck.json`     | 2    | yes, `error TS2322` |
| this branch, what CI runs            | `npm run build`                          | 2    | yes, `error TS2322` |
| this branch, labs project            | `npx tsc -p labs/tsconfig.json --noEmit` | 2    | yes, `error TS2322` |

`dist/`: **0** `dist/*.test.js` (81 on `main`) — nothing shipped changes, since `files` already dropped `**/*.test.*` from the tarball.

## `lib/tsconfig.typecheck.json` `rootDir: ".."` — kept, guard verified

Still needed: the kernel property tests import the shared runner from `test/`, outside `lib/`. I did not try to remove it by moving the runner into `lib/src/` — that would put a test-only, `fast-check`-importing file in the published package's source tree and need a build-exclude entry, and it would not help the CLI side (whose typecheck project also needs a root above `cli/src`).

The build project's guard is verified, not assumed. Probe `lib/src/zz-probe-source.ts` importing `../../test/property-runner.js`:

```
$ npx tsc -p lib/tsconfig.json --noEmit
lib/src/zz-probe-source.ts(1,24): error TS6059: File '…/test/property-runner.ts' is not
  under 'rootDir' '…/lib/src'. 'rootDir' is expected to contain all source files.
exit 2
```

## Q1 — the dependency-cycle box: my wording, and my honest reading

Verbatim as it stands in the item body (tick + annotation):

> - [x] Property: generated dependency graphs terminate and report the same canonical cycle set regardless of input traversal order. — **partially, and the gap is a filed kernel bug, not a narrowed test**: `lib/src/validate.property.test.ts` asserts unconditionally that the graphs terminate, that the cyclic/acyclic VERDICT is order independent, that completeness and absence of false positives both hold, and that every reported cycle is real, canonically anchored and deduped. The cycle _chain text_ and, for multi-cycle graphs, the _named cycle set_ are NOT order independent today: the rotation runs on the cycle array that already contains the closing node (`bug-dependency-cycle-chain-rotation-duplicates-a-node`). Both divergences are counted and logged per run and pinned as a canary, so the fix turns the suite red on purpose.

**My reading: the box is not met as written.** The emitted chain text is not order-independent, so "report the same canonical cycle set regardless of input traversal order" does not hold. Your call — I have **not** reworded the box and have left the tick untouched so you can see exactly what I ticked. The one-line change if you want the waiver form is `- [ ]` plus a `WAIVED (see bug-…): …` note; say the word and I will apply it verbatim.

## Q2 — the two canaries: what each asserts

Both are **bug canaries that pin current buggy behaviour**, and both now say so in the comment alone (fixed this round — they previously did not distinguish the buggy rows from the correct ones).

1. `frontmatter ambiguous scalar` — the table gained a `preserved` / `lost` verdict column, and the property **enforces** it (`preserved` rows must read back as the token, `lost` rows must not), so the table cannot lie about itself. `preserved` rows (`true`, `false`, `0`, `42`, `-7`) assert a **correct** invariant. `lost` rows (`null`, `~`, `00`, `-0`, `007`, `0123`, `-007`, `9007199254740993`, `12345678901234567890`) pin **today's wrong output** for `bug-frontmatter-ambiguous-plain-scalar-loss`; the comment says a fix flips them and turns the suite red first. Every row also asserts the correct part unconditionally: no throw, the loss is bounded to one normalization, the body is untouched.
2. Cycle chain shape — the `else` branch is the **correct** contract (`a -> b -> … -> a`, every member once, closing on the anchor). The `if` branch, guarded by `isRotationWithOneDuplicate`, pins **today's malformed output** for `bug-dependency-cycle-chain-rotation-duplicates-a-node`; the comment at both the helper and the branch, and in the file header, states that the pinned shape is not the expected output and that any third shape fails both branches. The per-run divergence counter keeps the "which cycles get named" part measured.

## Gates (real output, this worktree, head `ec95baaf`)

- `npm test` — `Test Files 103 passed (103)`, `Tests 1701 passed (1701)`, 62.00 s
- `npm run lint` — exit 0, no output
- `npm run build` — exit 0 (`tsc -p tsconfig.json` + `tsc -p tsconfig.typecheck.json`), `dist/*.test.js` count 0
- `npm run check:plugin` — exit 0, no diff to `opencode/plugins/arggon/index.bundle.ts`
- `npm run lint:structure` — exit 0, no findings
- `npm run test:structure` — `PASS` ×3, `test result: ok. 3 passed; 0 failed`
- `npm run arggon -- validate --json` — `{"ok":true,…,"errors":[],"warnings":[]}`
- extra: `npx tsc -p tsconfig.typecheck.json` exit 0, `npx tsc -p lib/tsconfig.typecheck.json` exit 0, `npx tsc -p labs/tsconfig.json` exit 0, `npm run test:property` → 5 files / 12 tests / 393 ms

PR #433 body rewritten with the A/B table, the labs regression, the lib-guard probe and the canary labelling. Draft, still open; `status: in_progress` left as is.

### handoff 2026-09-29 @Arggon — next: Coordinator: decide the cycle acceptance box (waive vs tick) and re-run the A/B probe; then merge PR #433 and land the two filed bugs with their canaries
- branch: feat/task-fast-check-invariant-properties
- open questions: Waive box 4 or require the cycle fix first?;Is the labs/tsconfig.json exclude guard acceptable scope?;Should the shared runner move out of test/ to drop both rootDir relaxations?
### 2026-09-29 @Arggon-coordinator
## FINAL APPROVE — PR #433 (`ea6c73c4`), p2

One blocking finding, which I found rather than the worker, and which the worker then found a
**second instance** of. Both are fixed and I re-ran every claim myself. **Merge authorized; this
comment performs no merge and no `done` flip.**

### The blocking finding: a silent deletion of an existing gate
The first pass added `"exclude": ["**/*.test.ts"]` to the root `tsconfig.json` with the comment
"Tests are type-checked by vitest/`labs`, never shipped". Neither half is true as a gate: vitest
transpiles via esbuild and never checks types, and `labs/tsconfig.json` is referenced by **no npm
script**. I proved the consequence with a controlled A/B — a `cli/src` test containing
`const n: number = "definitely not a number"`:

| tree / project | command | exit | catches |
| --- | --- | --- | --- |
| `main` build project | `npx tsc -p tsconfig.json` | 2 | yes (TS2322) |
| first pass, build project | `npx tsc -p tsconfig.json` | 0 | **no** |
| fixed, `npm run build` (what CI runs) | `npm run build` | 2 | yes (TS2322) |

**81 compiled `dist/*.test.js` files on `main` became 0** — so the surface losing coverage was real
and wide. A change that quietly turns the compiler off for the test suite, justified by a comment
asserting a safety property that does not hold, is the exact shape the review bar's "no shortcuts"
clause exists to catch, and it would have landed on all five new property files including the CLI
one.

### The worker found a second instance of the same class
Verifying the fix, it discovered that `extends` **inherits** `exclude`, so the new root exclude had
also silently disarmed `labs/tsconfig.json` — a project whose own README documents it as a
type-check command. That is a bug the original change created, caught by the person fixing it rather
than shipped. `labs/tsconfig.json` now carries `exclude: []`, and I re-ran the probe: exit 2. That
is the behavior I want from a worker: it fixed the thing I pointed at *and* looked for the same shape
next to it.

### Arrangement, and why I accept it
A new root `tsconfig.typecheck.json` (`noEmit`, `rootDir: "."`, includes `cli/src/**/*.ts` **and**
`test/**/*.ts`, `exclude: []`) is now the gate, and `npm run build` runs it after the emitter —
**mirroring the pattern `lib` already uses**, which is the strongest argument for it. `include` of
`test/**` is what puts the shared runner in the program; `exclude: []` is what overrides the
inherited value. The worker considered wiring the dormant `labs` project in instead and explained
why it did not: `labs` is undocumented as a script, is manual-only, and does not cover `test/**`,
so `npm run build` needs a project it can depend on. I agree.

I verified the `lib/tsconfig.typecheck.json` `rootDir: ".."` guard rather than taking the
reasoning: a probe source file in `lib/src` importing the runner fails the **build** project with
`TS6059: File ... is not under 'rootDir' ...`, exit 2. So a real source file escaping the package is
still an error; only the noEmit project is relaxed, and only as far as the test-only import requires.

### The properties themselves — judged on whether they model the real thing
A property suite that encodes a weaker model than production ships false confidence, so I read the
status property rather than counting tests. It drives the **real seam** (`assertUpdateRules`, which
CLI and MCP share), builds actions from the production types (`STATUSES`, `TRANSITIONS`,
`CLAIMABLE_TYPES`), and runs every generated sequence **twice — once as `agent`, once as `human`**,
which is what makes "terminal is absorbing" and "a human reopen must go through `todo`" real
invariants rather than slogans. It adds table-shape properties over the exported data itself (no
self-loops, no claim-skipping edge, every non-terminal status can still reach a terminal one). That
last one is a genuinely good idea: it is the property that would have caught a table edit that made an
item unclosable. Example-based suites remain authoritative for concrete contracts, as the item
required. Bounded and deterministic: 25 runs, fixed seed 20260928, no retry loop (`endOnFailure`),
env-var replay, ~0.4 s total for 12 tests. Soak runs at 4k–20k per property are recorded as evidence.

### The highest-value outcome: the suite found two real kernel bugs
1. **`bug-frontmatter-ambiguous-plain-scalar-loss`** — minimized to `parent: 06`: the second write emits `parent: 6`, and through the real path `arggon create task "0123"` → `show` already returns `123` and the next write **bakes the corruption in**. `null`/`~` drop the field with `validate` clean. This is silent data loss in the tracker's own source of truth, reachable from any numeric-looking id, label or `x-*` extra. The fix is identified (extend `formatScalar`'s force-quote predicate). This is exactly what the item was for.
2. **`bug-dependency-cycle-chain-rotation-duplicates-a-node`** — the same cycle printed `… -> 6 -> 6 -> 7` under one edge order and `… -> 6 -> 7 -> 7` under another; neither is a valid chain.

Neither is papered over. Each is pinned as a canary that **cannot lie**: the frontmatter table carries
a `preserved`/`lost` verdict column the property *enforces* (`preserved` must read back as the
token, `lost` must not), so a `preserved` row asserts a correct invariant and a `lost` row pins
today's wrong output and flips on the fix. The cycle property states the correct contract in one
branch and the pinned malformed output in the other, at the helper, at the branch, and in the file
header. I asked for both to be labeled from the comment alone, and they are now.

### Acceptance: 6 ticked, 1 explicitly waived — my call, recorded
I take the cycle property's own reading: **the box is not met as written.** The verdict is
traversal-order independent by theorem, but the emitted chain text and the named cycle set are not, so
asserting full text equality would be red. I am converting that box from a ticked-with-parenthetical
to an explicit **waiver under `docs/agents.md` §5.1** pointing at
`bug-dependency-cycle-chain-rotation-duplicates-a-node`. A parenthetical on a tick invites the next
reader to treat a partly-met acceptance as met; a waiver does not. The worker deliberately did not
reword the box to make it pass, and I am not rewording it either.

### Gates
103 files / 1701 tests (62 s) · `lint` · `build` (emitter + new typecheck project, 0 `dist/*.test.js`)
· `check:plugin` no diff · `lint:structure` 0 findings · `test:structure` 3 passed ·
`validate --json` `ok:true`. CI `36508003211` / `36508003234` success on this head. Plus
`npm run test:property` 5 files / 12 tests / 393 ms. Diff: 5 property files, the shared runner, the
two tsconfig projects plus the root one, `package.json`/`package-lock.json` for the exact
dev-only `fast-check@4.10.2`, two filed bugs, and the item. No production file, nothing under
`opencode/plugins/**`, `smoke/**` or `.github/workflows/**`.
