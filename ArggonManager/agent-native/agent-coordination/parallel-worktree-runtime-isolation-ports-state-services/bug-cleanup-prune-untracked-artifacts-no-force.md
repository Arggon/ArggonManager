---
type: bug
status: done
id: bug-cleanup-prune-untracked-artifacts-no-force
title: "cleanup --prune classifies a done+merged worktree removable and then fails on untracked generated artifacts, with no force path — every wave ends in manual git worktree remove --force"
assignee: arggon-delivery-lead
branch: fix/bug-cleanup-prune-untracked-artifacts-no-force
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, hygiene, friction]
created: "2026-10-12"
updated: "2026-10-12"
worktree_path: /home/arggon/Projects/ArggonManager-bug-cleanup-prune-untracked-artifacts-no-force
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-cleanup-prune-untracked-artifacts-no-force.md
  Leaves live only under a story. id is the filename stem: bug-cleanup-prune-untracked-artifacts-no-force.
  CLI `arggon create bug cleanup-prune-untracked-artifacts-no-force` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --prune classifies a done+merged worktree removable and then fails on untracked generated artifacts, with no force path — every wave ends in manual git worktree remove --force

## Context

Observed by the delivery lead at the end of the release-pipeline waves,
2026-10-12. `tools.arggon.cleanup({ prune: true })` on four done+merged
worktrees:

- classified all four `removable: true` ("remove worktree and delete the merged
  branch"), then failed the actual removal with git's own refusal:
  `contains modified or untracked files, use --force to delete it`;
- each worktree's only "content" was untracked generated scaffolding:
  `.opencode/harness/`, `.opencode/checks/`, `.opencode/specs/` (agent-harness
  and local-tooling artifacts, never committed, never in a PR);
- the tool exposes no `--force`, so the wave ended in a manual loop
  (`git worktree remove --force <path>` + `git branch -D` per branch) and a
  second prune run just to clear the `worktree_path` records.

The conservative refusal is right for unknown files; the gap is that a
done+merged worktree's untracked **generated** paths have no handling, and the
classify/act mismatch (`removable: true` → raw failure) reads as a bug to the
operator. Note the artifacts' origin is partly outside ArggonManager (a local
agent-harness plugin writes `.opencode/harness/`), so the fix should not assume
it can prevent them.

## Acceptance

- [x] Decide and implement one: (a) `cleanup` reaps a declared set of generated
      paths (e.g. the worktree env contract's own artifacts plus a configurable
      ignore list) before removal; (b) an explicit `--force` / `takeOver`
      equivalent for prune on terminal+merged items; or (c) a recorded decision
      that manual force-removal is the intended remedy — with the reasoning
      (the current receipt does name the command, but not the branch deletion or
      the record-clearing second run)
- [x] Classification is honest: if the tool will not remove it, it must not
      print `removable: true` with a null reason — or the failure must name the
      full manual sequence (remove --force, branch -D, re-run prune)
- [x] A test covers the chosen path (a worktree with an untracked artifact file
      / dir), and `cleanup --prune` stays conservative for unknown untracked
      files (never silently discards uncommitted work)
- [x] If generated paths are hard-coded, they come from the same declarations
      the rest of the system uses (the worktree env/state contract), not a new
      ad-hoc list

## Notes

### 2026-10-12 @arggon-maker — decision: (b), with the reasoning for the two rejections

- **(a) refused — a declared reap set / configurable ignore list.** The
  incident's paths (`.opencode/harness/`, `.opencode/checks/`,
  `.opencode/specs/`) are written by a local agent-harness plugin that is not
  ArggonManager's, so a kernel list would have to encode third-party locations
  the kernel does not own (the item says so explicitly). Worse, a silent
  pre-removal purge of a declared path set discards unknown untracked work
  without the operator's act — exactly what the conservative default exists to
  prevent — and it cannot tell generated scaffolding from hand-written
  untracked work.
- **(c) refused — manual force-removal as the intended remedy.** That is the
  friction this item exists to remove: four worktrees, a manual
  `git worktree remove --force` + `git branch -D` loop, then a second prune just
  to clear the `worktree_path` records. The manual path also bypasses every
  kernel gate (no terminal+merged check, no tracked-file protection, no
  receipt).
- **(b) chosen — `--force` on `cleanup --prune`** (native
  `cleanup({ prune: true, force: true })`, MCP property `force`): per-entry,
  explicit, and narrowed to the terminal+merged+untracked-only window.

### The exact refusal/force semantics

One porcelain probe (`git status --porcelain`) of an existing, registered
worktree classifies its removal blockers by kind. The start-owned entries every
run reaps itself — start's install link/farm and a start-shaped `.arggon.env`
(ownership predicates shared with `unlinkNodeModulesLink`/`unlinkWorktreeEnv`,
plus the new `WORKTREE_ENV_FILE`/`WORKTREE_NODE_MODULES_ENTRY` declarations) —
are discounted, so those worktrees keep pruning unforced (the F2/R3 suites are
unchanged).

| Worktree content                           | no `--force`                                                                    | `--force`                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| nothing (or only start-owned artifacts)    | `removable: true`, action `remove worktree and delete the merged branch`        | same (not forced)                                                                  |
| **untracked** blockers only                | `removable: false` + reason naming the paths, `--force` and the manual sequence | `removable: true`, `forced: true`, action says "forced past its untracked content" |
| **tracked** modifications (alone or mixed) | `removable: false` + reason naming the tracked paths, "commit or discard first" | unchanged refusal — the flag never discards tracked work                           |

- `forced` is per entry and only ever set on an entry that already passed the
  terminal-status, integration (ancestry or merged PR) and remote-safety gates —
  a live claim is unreachable by construction, and `--force` without `--prune`
  is a typed refusal on both surfaces (`--force requires --prune` /
  `force requires prune`).
- Evidence fields (additive within `schemaVersion: 1`):
  `candidates[].forced`, `candidates[].blockingPaths`/`blockingTotal`,
  `candidates[].blockingTracked`/`blockingTrackedTotal`, `pruned[].forced`.
  Named paths are capped at 10 with the exact total, each bounded per path (120
  chars) because they come from the classified worktree and ride the envelope.
- **One existing contract test was narrowed, deliberately**:
  `cli/src/mcp-server.test.ts` asserted that _no_ spawn tool exposes a `force`
  property. The project's human-only force is `update --force` (claim
  reassignment; `engineering.md` §Authority map) and it stays refused for agents
  with no native parameter; `cleanup`'s `force` is the audited prune opt-in and
  never touches a claim. The test now pins both facts (`steal` on no spawn tool,
  `force` only on `arggon_cleanup`) instead of the name collision.

### Tests that pin it

Kernel (`lib/src/cleanup.test.ts`, new): `parseRemovalBlockers` splits untracked
from tracked in porcelain order / skips ignored / unquotes; the untracked
refusal names the blockers, both force spellings and the full manual sequence
(`git worktree remove --force …`, `git branch -D …`, `arggon cleanup --prune`);
the cap keeps the exact count; the tracked refusal never offers force; an
over-long path is bounded.

CLI (`cli/src/worktree.test.ts`): _honestly skips a worktree with untracked
generated artifacts, then reaps it with `--force`_ (conservative default: nothing
attempted, nothing touched, escaped reason + `blockingPaths`; then
`pruneForce: true` removes with `forced: true`); _never force-removes uncommitted
tracked work, with or without the force opt-in_ (refused twice; the modified file
is proven intact); _refuses `--force` without `--prune`_; _threads `--force`
through the CLI surface (human and `--json`)_.

Native (`opencode/plugins/arggon/tools.test.ts`): _reaps untracked blockers only
with force, and reports the forced discard_ (domain `remove({ force: true })` for
exactly that entry); _skips a foreign `node_modules` install instead of
force-removing it without force_ (rewritten from the old classify/act-mismatch
expectation, which the new classification makes obsolete); _never force-discards
uncommitted tracked work_; _`force` without `prune` fails typed_.

Docs travel with the change: `docs/agents.md` §Cleanup (force semantics,
remedies, the reserved-power boundary), `docs/json-output.md` §cleanup (the new
additive fields, the honest `removable` semantics), `docs/opencode2.md` (native
payload row + the observed-removal paragraph + the re-measured catalog bytes).
`npm run build:plugin` regenerated and committed `opencode/plugins/arggon/index.bundle.ts`.

### Gates (item worktree; expected vs observed)

| Gate                                | Expected                            | Observed                                                        |
| ----------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| `npm run build`                     | tsc projects + bundle regen clean   | clean; `build:plugin — 48 modules inlined, 556482 bytes`        |
| `npm run test`                      | full suite green                    | 149 files / 3,244 tests passed, 0 failed                        |
| `npm run test:structure`            | 5 ast-grep rule tests pass          | 5 passed, 0 failed                                              |
| `npm run lint:structure`            | no findings                         | no findings (exit 0)                                            |
| `npm run arggon -- validate`        | ok, 0 warnings                      | `ok (0 warning(s), convention v5)`                              |
| `npx prettier --check` (changed)    | every changed file formatted        | all matched files use Prettier code style                       |
| `npm run check:plugin`              | committed bundle byte-identical     | no diff against a fresh `build:plugin`                          |
| `npm run context:report`            | native catalog within budget        | `native arggon tools (15, 9 pinned) 12,189 ≤12,288 B adv. pass` |
| `npm run arggon -- doctor --budget` | live MCP `tools/list` within budget | 16,296 B ≤ 16,384 B (pass)                                      |

Out of scope, reported only: both ADR 0006 advisory budgets are now nearly
exhausted (99 B native headroom, 88 B MCP headroom — the `force` property is bare
on both surfaces by budget), and `docs/opencode2.md`'s catalog-bytes figure was
already stale before this change (11,821 B documented vs ~12,161 B measured); it
is corrected here.

### Handoff (maker → delivery lead)

- **Branch:** `fix/bug-cleanup-prune-untracked-artifacts-no-force` (pushed; PR
  open, unmerged). Commits: `fix(cleanup)` (code + docs + tests + bundle) and
  `chore(tasks)` (this file).
- **Next concrete step:** delivery-lead review + merge; the PR body carries the
  problem, the approach and the test plan. After merge the recorded
  `worktree_path` of a blocked worktree keeps it visible to `cleanup`, so the
  next wave can run `cleanup --prune --force` instead of the manual loop.
- **Open questions for review:**
  - The flag is named `--force` as the item's steer named it. The human-only
    force is `update --force` (claim reassignment, refused for agents); cleanup's
    force never touches a claim, and `cli/src/mcp-server.test.ts` was narrowed to
    pin the boundary (`steal` on no spawn tool, `force` only on `arggon_cleanup`).
  - Budget pressure above: the next native/MCP schema addition needs a trim
    first; `force` is bare on both surfaces because of it.
  - Runtime confirmation: the fix is exercised on fixtures (untracked artifact
    file/dir, foreign `node_modules`, tracked modification) on both surfaces; the
    original incident replay on the four real worktrees is a delivery-lead call
    once merged (they were already reaped by hand).

### 2026-10-12 @arggon-standards-reviewer

### 2026-10-12 @arggon-standards-reviewer (independent, read-only, item worktree)

verdict: request-changes (docs only: three carriers still deny the `force` parameter this PR adds, and the README cleanup flag list omits `--force`; the code, tests, bundle and the three docs the maker updated are clean)

**F1 — blocking (docs): carriers still say "there is no `force` parameter", now false.**

- `ArggonManager/docs/agents.md:480` §MCP server: "an MCP caller cannot ... steal a claim (there is no `force` parameter)".
- `skills/arggon-cli/references/json-contract.md:106` §MCP surface: "there is no `force` parameter anywhere on the surface".
- `arggon_cleanup` now ships `force` (`cli/src/mcp-server.ts:531`, spawned as `--force` at :796; native `force: BOOLEAN` at `opencode/plugins/arggon/index.ts:5137`), and the narrowed `cli/src/mcp-server.test.ts` pin asserts it. The intent is right — no parameter touches a claim — but both sentences now read as factually false, in exactly the carriers an agent consults to discover the remedy this item exists to provide. `mcp-doc-contract.test.ts` pins membership/count only, so CI cannot catch it — the defect class its own docstring names ("a carrier restates a fact that changed elsewhere and the restatement is never updated").
- Fix (prose only): "no `force` parameter touches a claim (`update --force` stays human-only with no native/MCP parameter); the only `force` is `arggon_cleanup`'s audited prune opt-in, refused without `prune`".

**F2 — blocking (docs): README §cleanup flag list omits `--force` and predates the classification.**

- `README.md:373` lists "Flags: `--prune`, `--release <id>`, `--take-over-worktree`, `--no-commit`, `--no-gh`, `--json`" — every other cleanup flag is listed (this is the maintained surface); `--force` is absent. The same paragraph's "dirty worktrees are refused by git, except that a start-created `.arggon.env` ... is reaped first" no longer describes the receipt (blockers are classified up front, skipped with `blockingPaths`, or reaped under the opt-in), and the release arm's "the only thing that forces the removal" now reads unqualified beside prune's `--force`.
- Fix: add `--force` to the list and one clause for the untracked-blocker classification/opt-in.

**Non-blocking notes**

- N1 `lib/src/cleanup.ts:430`: when the porcelain probe returns `undefined`, the classifier keeps the pre-probe shape (`removable: true`, then a raw `failed` git error that does not name the manual sequence). Reachable only for an already-broken worktree — git's own removal check runs the same status probe — and documented in code; a follow-up could carry the manual sequence in the `failed` message too.
- N2 `ArggonManager/docs/json-output.md:572`: the `release` row's "the only case in which the removal is forced" is true within the release arm, but `agents.md` got the "(prune's own, narrower opt-in is `--force`)" qualifier and this row did not.
- N3 nit: in the mixed tracked+untracked case `blockingPaths` is emitted untracked-first (`lib/src/cleanup.ts:442`), which the field note's "as ONE `git status --porcelain` probe reported them" can be read to contradict; the count cap and exact `blockingTotal` hold either way.

**Verified by reading (clean)**

- Decision (b) narrowings hold end to end: `classifyCleanupEntry` order is terminal → branch → integration (ancestry or merged PR) → remote safety → existence/registration → one porcelain probe (`lib/src/cleanup.ts:371-471`); `forced` is set only inside that terminal+merged branch, only when every non-start-owned blocker is `??` and `deps.force === true` (:448-460). Live claims are unreachable by construction; `--force` without `--prune` refuses on all three surfaces — CLI throw (`cli/src/cleanup.ts:308`), native typed `CLEANUP_FAILED` (`opencode/plugins/arggon/index.ts:4633`), MCP (spawns the CLI and gets the `failJson` envelope; `cli/src/cli.ts` catch).
- Tracked modifications refused with and without force (`lib/src/cleanup.ts:439-447`), proven intact by both suites' tests.
- `--force` reaches git for exactly the classified entry: CLI `removeWorktree(root, path, { force: entry.forced === true })` (`cli/src/cleanup.ts:424`), native `removeWorktreeObserved(..., { force: entry.forced === true })` (`index.ts:4740`), and `defaultCleanupGit.removeWorktree` maps it to an argv array (`lib/src/cleanup.ts:249`). Start-owned unlink targets match the classifier's `primaryRoots`: CLI loop `mainRoot = worktreeList(root)[0]` + `root` (`cli/src/cleanup.ts:412-413`) vs the kernel default `[registered[0], root]`; native passes `[canonicalRoot(options, root), root]` and unlinks the same two (`index.ts:4727-4731`). Foreign `node_modules` and adopter-shaped `.arggon.env` stay blockers unforced.
- Classification honesty: reasons name the blockers (≤10 names, each ≤120 chars) + both force spellings + the full manual sequence (`remove --force`, `branch -D`, re-run prune); the tracked refusal never offers force; caps and exact totals ride `blockingPaths`/`blockingTotal`/`blockingTracked`/`blockingTrackedTotal`.
- Single logic path: the kernel owns the semantics; CLI/MCP/native only thread `force`; the committed bundle carries the same code and the emitted `cleanup` spec's `force: BOOLEAN` (spot-checked in `index.bundle.ts`).
- Tests discriminate (they would fail without the change): new kernel parser/refusal suite, CLI real-git skip-then-force / tracked-never-forced / force-without-prune / CLI threading, native domain `remove({ force: true })` for exactly that entry + typed refusal. The narrowed `mcp-server.test.ts` pin is justified and not weakened: `steal` on no spawn tool, `force` on no `start`/`branch`/`update`, and the one granted surface positively pinned; no test deletions.
- The three docs the maker updated (`agents.md` §Cleanup, `json-output.md` §cleanup, `opencode2.md` payload row/figure) match the implementation; scope is clean (the `worktree.ts` read-only ownership twins are AC4's shared-declaration requirement and preserve `unlink*` semantics; the opencode2.md figure correction is disclosed).

**Execution evidence (read, not run — this role does not execute gates)**

- PR #751 checks: `cli` SUCCESS (build, `check:plugin`, `npm test`, lint, `test:structure`, `lint:structure`, spec baseline, `smoke:native-start-cold`), `ui-smoke` SUCCESS, `tasks-validate` SUCCESS → the committed-bundle drift gate and the full suite are green on this head.
- Not verifiable by reading: the advisory `doctor --budget` figures (12,189 B native / 16,296 B MCP) and a standalone fixture smoke record.

## Probes needed (verifier; advisory — does not change this verdict)

- `npm run arggon -- doctor --budget` (cwd: the item worktree) — expected native ≤ 12,288 B, MCP ≤ 16,384 B; if it fails, the opencode2.md figure and a trim decision change.
- Optional §Review bar smoke record: on a throwaway fixture repo, `arggon cleanup --prune --json` → skip with `blockingPaths` + reason; then `arggon cleanup --prune --force --json` → `removed worktree … forced: true`. CI's real-git integration tests already cover this shape.

Recommendation: no-merge until F1/F2 are fixed (docs-only, no code change); the code half is approvable as-is.

### 2026-10-12 @arggon-maker — review response (docs-only round)

F1/F2/N2 fixed in `9dae1a8a` — docs only, no code touched:

- **F1** — `ArggonManager/docs/agents.md` §MCP server and
  `skills/arggon-cli/references/json-contract.md` §MCP surface now state that no
  `force` parameter touches a claim (`update --force` stays human-only, with no
  native/MCP parameter) and that the only `force` on the surface is
  `arggon_cleanup`'s audited prune opt-in (terminal+merged, untracked blockers
  only, refused without `prune`/`force requires prune`, never tracked
  modifications).
- **F2** — `README.md` §cleanup: `--force` added to the maintained flag list,
  and the paragraph now describes the up-front blocker classification (skip with
  `blockingPaths`/`blockingTotal` + a reason naming `--force` and the manual
  sequence; tracked modifications refused with or without it; start-owned
  artifacts never blockers) instead of the pre-classification "dirty worktrees
  are refused by git" sentence; the release arm's "only thing that forces the
  removal" is qualified as the release's own hatch.
- **N2** — `ArggonManager/docs/json-output.md` release row now carries the
  "(prune's own, narrower opt-in is `--force`, reported as `candidates[].forced`)"
  qualifier.
- **Wording check across the carriers** (agents.md §Cleanup + §MCP server,
  json-contract.md, README.md, json-output.md): default refusal, `--force`
  requires `--prune`, terminal+merged+untracked-only, tracked modifications never
  discarded, and the manual sequence named in the refusal — no contradictions.
- **Gates for this round**: `npx prettier --check` on the four changed files
  clean; `npm run arggon -- validate` ok (0 warnings); `cli/src/mcp-doc-contract.test.ts`
  - `cli/src/skill-generated-commands.test.ts` + `cli/src/prose-format.test.ts`
    25/25 passed; `npm run skills:sync` refreshed the gitignored vendored copies.
- N1 (probe-degradation fallback shape) and N3 (emission order) left to the lead,
  as instructed.

### 2026-10-12 @ses_ed6d54e92ffe2VO1GeR34DQEEy
### 2026-10-12 @arggon-delivery-lead
verdict: approve (lead merge call) — the standards request-changes (docs only) is resolved and verified at the cited lines; verifier confirmed the execution probes

- Standards review: `verdict: request-changes` scoped to two stale docs claims ("no `force` parameter anywhere" in `agents.md`/`json-contract.md`; README's cleanup flag list) plus one qualifier (`json-output.md` release row). Code half was clean as-is.
- Resolution verified by the lead at the cited lines: `agents.md` §MCP server and `json-contract.md` now name the cleanup-only `force` (prune-gated, terminal+merged+untracked-only, never tracked work; `update --force` stays human-only); `README.md` lists `--force` and the new classification; `json-output.md` carries the narrower-opt-in qualifier. The maker's contradiction check across all five carriers is recorded on the item.
- Verifier evidence: kernel+CLI cleanup suites **86/86** (skip-without-force → reap-with-force → tracked-never-forced → force-requires-prune); `check:plugin` exit 0 with the committed bundle byte-identical to a fresh build; budget figures reproduced (native 12,189 B via `context:report`, MCP 16,296 B via `doctor --budget`) after the citation fix; the standalone scratch smoke was environment-blocked (sandbox denies direct git commit) and is covered by the real-CLI test shape.
- Residuals: the probe-degradation fallback shape (reviewer N1) is filed as a follow-up; N3 (emission order) accepted as-is. Merging now; auto-done flips this item on merge.
