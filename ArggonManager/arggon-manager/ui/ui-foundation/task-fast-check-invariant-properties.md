---
type: task
status: todo
id: task-fast-check-invariant-properties
title: "Add fast-check properties for parser, status, dependency, UTF-8, and worktree invariants"
parent: ui-foundation
labels: [testing, property-based, kernel]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
depends_on: [bug-native-start-worktree-no-install, task-ast-grep-structural-rules]
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

- [ ] Add an exact/dev-only `fast-check` dependency with a small reusable bounded runner or deterministic seed/replay policy for normal CI.
- [ ] Property: valid generated item frontmatter survives parse → serialize → parse without losing required fields or changing unrelated body text.
- [ ] Property: status transitions preserve the legal transition table and terminal `done`/`cancelled` items cannot be reopened by any generated transition sequence.
- [ ] Property: generated dependency graphs terminate and report the same canonical cycle set regardless of input traversal order.
- [ ] Property: bounded UTF-8 detail clipping never splits a code point, respects the byte cap, and preserves valid text for representative multibyte input.
- [ ] Property: worktree cleanup/ownership classification remains safe and idempotent for generated link/farm shapes, including foreign installs that must never be removed.
- [ ] Each property has an explicit invariant comment, bounded complexity, a deterministic replay seed on failure, and ordinary example-based tests remain authoritative for concrete contracts.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, and `arggon validate` are green without runtime dependency or production behavior changes; PR evidence includes run counts/seeds and any minimized counterexample.

## Notes

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
