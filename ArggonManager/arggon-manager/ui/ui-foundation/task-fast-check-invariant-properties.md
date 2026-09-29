---
type: task
status: in_progress
id: task-fast-check-invariant-properties
title: "Add fast-check properties for parser, status, dependency, UTF-8, and worktree invariants"
assignee: Arggon
branch: feat/task-fast-check-invariant-properties
parent: ui-foundation
labels: [testing, property-based, kernel]
priority: p2
created: "2026-09-24"
updated: "2026-09-29"
claimed_at: "2026-09-29T00:17:01.426Z"
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
- [x] Property: generated dependency graphs terminate and report the same canonical cycle set regardless of input traversal order. — **partially, and the gap is a filed kernel bug, not a narrowed test**: `lib/src/validate.property.test.ts` asserts unconditionally that the graphs terminate, that the cyclic/acyclic VERDICT is order independent, that completeness and absence of false positives both hold, and that every reported cycle is real, canonically anchored and deduped. The cycle _chain text_ and, for multi-cycle graphs, the _named cycle set_ are NOT order independent today: the rotation runs on the cycle array that already contains the closing node (`bug-dependency-cycle-chain-rotation-duplicates-a-node`). Both divergences are counted and logged per run and pinned as a canary, so the fix turns the suite red on purpose.
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
