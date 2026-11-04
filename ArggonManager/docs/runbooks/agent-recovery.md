# Agent recovery

Layer: **reference / recovery**. Read only for a failed close-out, an abandoned claim or cleanup refusal; the normal loop is in [the operational core](../agents.md).

#### Cleanup

When the work is done and merged, `arggon cleanup` lists (and with `--prune` removes) the stale worktrees; a kept worktree you do not want (e.g. after a claim conflict) is discarded with the exact command the failure message prints (`git worktree remove --force <path>`, plus `git branch -D <branch>` when start created the branch). `cleanup --prune` also auto-commits (it clears `worktree_path`), so push main right after it — an unpushed cleanup auto-commit has traveled as contraband on a branch cut before.

`--prune` is honest about what it can actually remove (bug-cleanup-prune-untracked-artifacts-no-force). A terminal+merged worktree with removal-blocking content is **not** reported `removable: true` and then failed on a raw git error; classification probes the worktree (`git status --porcelain`) and skips it with a reason that names the blocking files and the exact remedy:

- **Untracked blockers** (generated scaffolding that only ever lived in the worktree — agent-harness output, local tool state, the incident's `.opencode/harness/`) — `removable: false`, with `blockingPaths`/`blockingTotal` in the envelope. Nothing is discarded without the opt-in: `--force` (native: `tools.arggon.cleanup({ prune: true, force: true })`) reaps it by passing `--force` to that removal alone, reports `forced: true` on the candidate and the `removed worktree` action, and stops there — a terminal+merged item only, never a live claim, never a tracked modification. Without the flag, unknown untracked work is safe from an accidental prune; `--force` requires `--prune` and is refused alone. The skip also names the manual sequence (`git worktree remove --force <path>`, `git branch -D <branch>`, then `arggon cleanup --prune` to clear the record).
- **Tracked modifications** — refused WITH and WITHOUT `--force` (`blockingTracked`/`blockingTrackedTotal`): the force opt-in never discards uncommitted tracked work. Commit or discard it first.
- The start-owned artifacts every run reaps itself — start's install link/farm and a start-shaped `.arggon.env` — are never blockers, so those worktrees keep pruning exactly as before.

`--prune` only reaps **finished** work (terminal item + merged branch), so it cannot reap an **abandoned claim**: an item back in `todo` is invisible to it. That is what `--release <id>` is for (bug-unclaim-leaves-worktree-record-without-reaper) — the inverse of `start --worktree`, the other arm of the same worktree domain:

- `arggon cleanup --release <id>` (native: `tools.arggon.cleanup({ release: "<id>" })`) removes that item's worktree, deletes its branch, reaps the start-created `.arggon.env` and the `arggon-claim.json` stamp, and clears the `worktree_path` record — reported as its own `release`/`released` action family, never mixed into `pruned`. Run it from the checkout whose tracker copy carries the record: the claim commit rides the feature branch, so before it merges that copy is the **worktree itself** (release from the claiming session's worktree).
- It is **refused**, never forced, while the item is still `in_progress` with an assignee: a re-claimed item has a live owner, and the cheap remedy is that owner's own unclaim. `--take-over-worktree` does **not** bypass this (the hatch is for a _presumed-dead stamped owner on an unclaimed item_, where nothing durable would record the override).
- Two more refusals, same shape and same both-surfaces reporting: a stamp held by another identity whose window shows a live writer (the F12 evidence rides `release.foreignWrites`), and a worktree with uncommitted or untracked content (`release.blockingPaths`/`blockingTotal`) — refused during classification, before anything is reaped, so a failed release leaves the worktree's claim stamp and `.arggon.env` standing and the next attempt still has its evidence. The claim stamp is reaped only AFTER an observed removal.
- `arggon cleanup --release <id> --take-over-worktree` / `tools.arggon.cleanup({ release, take_over_worktree: true })` is the audited hatch for a presumed-dead stamped owner, exactly like `start --take-over-worktree`: it passes those two refusals, records the replaced stamp in `release.takeOver`, and is the only thing that forces a release's removal (prune's own, narrower opt-in is `--force`, above) — so uncommitted work is never discarded silently. Without a release it is refused (`--take-over-worktree requires --release <id>`), and `--force` is refused without `--prune`.
- A recorded worktree that is already **gone as work** — the directory removed, or leftover debris whose gitdir link is gone (git lists the record `prunable` after an interrupted removal, or a manual `git worktree prune` dropped it) — is a stale record, not a release target (bug-cleanup-release-stale-record-wedge): the release skips the removal, prunes the dead git record itself (no manual `git worktree prune`), still deletes the branch that record names — the worktree can no longer be asked and the unclaim cleared the item's `branch` field — and clears the `worktree_path` record, leaving any leftover directory in place.
- A `blocked` item is not a claim (it keeps its assignee as context, not as a lease), so it is not refused here — the single-writer and content gates still protect a live writer.
- `--release` and `--prune` are mutually exclusive — two reapers, one run.

### Auto-done on merge

The `auto-done` workflow (`.github/workflows/auto-done.yml`) mirrors `start` on the done side: when a PR referencing `task-*`/`bug-*` ids merges into `main`, it flips claimed items to `done` through `arggon update`, runs the test suite on the flip tree, and lands the change as a squashed `github-actions[bot]` PR (the workflow posts the required `cli` check on the flip commit itself — bot pushes/PRs don't trigger CI). Limits you must still cover yourself:

- It only performs the legal `in_progress` → `done` transition. Items still `todo` or `blocked` when the PR merges are skipped with a warning annotation — claim before merging, or mark them manually.
- It never edits acceptance checklists and never touches containers (story/epic/initiative) — tick the checklist in the item's live `## Acceptance` section before the PR merges; fenced repro boxes and dated comment blocks never count, so nothing in a body has to be rewritten to satisfy the gate. Since the done gate ([ADR 0015](../adr/0015-done-gate-acceptance-waiver.md), scoped by [ADR 0025](../adr/0025-done-gate-live-acceptance-section.md)), a flip refused by the gate is tolerated like the skipped-todo case: a warning annotation, and the item stays `in_progress` until a human ticks the live checklist, publishes one where there is none, or waives (`arggon update <id> --status done --waive "<reason>"`).
- Reference the item id in the PR title or body (the id is what the workflow greps for).

**Why flip PRs can wedge:** merging several PRs rapidly triggers concurrent auto-done runs, and sibling main commits (other flips, review comments) make the open flip PRs out-of-date, so the bot's self-merge fails — and it cannot be repaired with `update-branch`, because a rebased bot head would lack the required `cli` check (bot pushes never trigger CI). The workflow is race-tolerant since task-autodone-flip-race: before each merge attempt it rebases the flip branch onto fresh `origin/main`, re-posts the `cli` check on the new head, and retries (3 attempts). If the rebase itself conflicts — possible since task-autodone-flip-wedge-3, when a coordinator `arggon comment` on a flipped item auto-commits the same item file to main mid-flight — the workflow instead redoes the flip on a fresh `origin/main` worktree (bounded, 2 attempts: re-run the idempotent `update --status done`, push a new flip branch, re-post the check, merge, delete the wedged branch). If it still fails, the only recovery is an admin merge of the flip PR — the run log names this in a `::warning::`.

### Unclaim

`in_progress` → `todo` clears `assignee` and the recorded `branch` (v0). Prefer
that over leaving a stale claim:

```bash
arggon update <id> --status todo
```

**Unclaiming does not release the worktree.** A claim made through
`start --worktree` also owns a worktree, a branch, a `.arggon.env` and a claim
stamp, and the assignee is only one of those: the worktree survives the unclaim
(only `worktree_path` stays recorded, since `update` is a frontmatter-only
operation — it is the very call `cleanup` uses to clear that record, and it must
never destroy a working tree on a status flip). So the unclaim call itself
reports what it left behind and names the path that reaps it — `claimFootprint`
in the `--json` envelope, `⚠ claim dropped: … release it with: arggon cleanup
--release <id>` on stdout, and the native `update` tool's `claimFootprint`
carrying `tools.arggon.cleanup({ release: "<id>" })`. If you drop a claim that
created a worktree, release it with `arggon cleanup --release <id>` (§Cleanup);
nothing else will, because `--prune` only reaps terminal, merged work. The
receipt is **unclaim-only**: a `→ done` flip leaves the same footprint, but there
`cleanup --prune` is the merge-gated remedy (a release force-deletes the branch
and never checks merge state), and a blocked item keeps its assignee, so neither
names a release.
