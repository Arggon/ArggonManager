---
type: bug
status: in_progress
id: bug-cleanup-prune-untracked-artifacts-no-force
title: "cleanup --prune classifies a done+merged worktree removable and then fails on untracked generated artifacts, with no force path — every wave ends in manual git worktree remove --force"
assignee: arggon-delivery-lead
branch: fix/bug-cleanup-prune-untracked-artifacts-no-force
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, hygiene, friction]
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T22:10:29.800Z"
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

| Gate                                | Expected                          | Observed                                                                  |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `npm run build`                     | tsc projects + bundle regen clean | clean; `build:plugin — 48 modules inlined, 556482 bytes`                  |
| `npm run test`                      | full suite green                  | 149 files / 3,244 tests passed, 0 failed                                  |
| `npm run test:structure`            | 5 ast-grep rule tests pass        | 5 passed, 0 failed                                                        |
| `npm run lint:structure`            | no findings                       | no findings (exit 0)                                                      |
| `npm run arggon -- validate`        | ok, 0 warnings                    | `ok (0 warning(s), convention v5)`                                        |
| `npx prettier --check` (changed)    | every changed file formatted      | all matched files use Prettier code style                                 |
| `npm run check:plugin`              | committed bundle byte-identical   | no diff against a fresh `build:plugin`                                    |
| `npm run arggon -- doctor --budget` | advisory bounds pass              | native catalog 12,189 B ≤ 12,288; live MCP `tools/list` 16,296 B ≤ 16,384 |

Out of scope, reported only: both ADR 0006 advisory budgets are now nearly
exhausted (99 B native headroom, 88 B MCP headroom — the `force` property is bare
on both surfaces by budget), and `docs/opencode2.md`'s catalog-bytes figure was
already stale before this change (11,821 B documented vs ~12,161 B measured); it
is corrected here.
