---
type: bug
status: todo
id: bug-claim-pool-computed-from-main-misses-branch-claims
title: "`list`/`next` compute the claimable pool from `main`, but a claim made in a worktree rides its branch — so every in-flight item reads `todo`/unassigned on main and is offered to an agent that `start` then refuses"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [tracker-schema, worktree, hygiene, claims]
created: "2026-10-05"
updated: "2026-10-05"
---

<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-claim-pool-computed-from-main-misses-branch-claims.md
  Leaves live only under a story. id is the filename stem: bug-claim-pool-computed-from-main-misses-branch-claims.
  CLI `arggon create bug claim-pool-computed-from-main-misses-branch-claims` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `list`/`next` compute the claimable pool from `main`, but a claim made in a worktree rides its branch — so every in-flight item reads `todo`/unassigned on main and is offered to an agent that `start` then refuses

## Context

Found by the delivery lead on 2026-10-05 while reconciling 7 open PRs whose items all sat at `todo` on `main` with no assignee, no `branch` and no `worktree_path`.

**The mechanism.** A claim made through `tools.arggon.start({ worktree: true })` writes its frontmatter and its claim commit **inside the item's worktree**, so the claim rides the item's **branch**. Until that branch merges, `main`'s copy of the item is unchanged — it still reads `status: todo`, `assignee: null`. `list` and `next` read the tree they are pointed at, which for a normal delivery session is `main`. So the claimable pool is computed from a copy that has never seen the claim.

**Observed, not inferred.** Reconciling PR #620 (`task-adr-index-parity-does-not-check-titles`): `tools.arggon.show({ id, meta: true })` reported `status: todo`, `assignee: null`, `updated: 2026-10-03` — unclaimed and rankable. `tools.arggon.start({ id, assignee: "arggon-delivery-lead", worktree: true })` on the same id returned:

```
START_FAILED: claim conflict: 'task-adr-index-parity-does-not-check-titles'
is claimed by 'Arggon' (status in_progress).
```

with `claimCommitted: false, reason: "claim update refused"`. Diffing the three copies explains the contradiction:

| copy                                                      | status        | assignee | claimed_at                 |
| --------------------------------------------------------- | ------------- | -------- | -------------------------- |
| `main`                                                    | `todo`        | —        | —                          |
| `origin/feat/task-adr-index-parity-does-not-check-titles` | `in_progress` | `Arggon` | `2026-10-03T12:48:04.010Z` |
| the worktree on disk                                      | `in_progress` | `Arggon` | `2026-10-03T12:48:04.010Z` |

The refusal was **correct and the safety net held** — `start` refused, the claim rolled back (`rollback.preparationRemoved: true`), and no claim was stolen. That is this system working. The defect is that it had to work: the pool advertised an item that was live-claimed.

**Blast radius.** Four of the five remaining PRs carry a live claim that `main` does not know about:

| PR   | item                                              | claim on its branch            |
| ---- | ------------------------------------------------- | ------------------------------ |
| #620 | `task-adr-index-parity-does-not-check-titles`     | `Arggon`, 2026-10-03T12:48:04Z |
| #619 | `bug-validate-does-not-check-frontmatter-present` | `Arggon`, 2026-10-03T12:48:00Z |
| #618 | `bug-engineering-doc-stale-adr-statuses`          | `Arggon`, 2026-10-03T12:47:53Z |
| #586 | `task-explore-adopter-feedback-channel`           | `Arggon`, 2026-10-02T14:18:08Z |

Every one of those four is ranked as claimable work by `next` while being genuinely held. A delivery lead planning waves from `next` will keep picking them and keep getting refused — and, worse, a lead that trusted the pool over the refusal would be tempted to reach for a force path that the kernel correctly forbids agents. `list --stale` is affected the same way: a claim that is live but invisible on `main` cannot be reported stale, and equally cannot be seen as held.

This is the mirror image of `bug-native-arggon-tools-resolve-tracker-root-to-session-cwd`: that one is a write landing in the wrong checkout, this one is state landing on a copy nobody reads.

## Acceptance

- [ ] The claimable pool does not advertise an item whose claim lives on an unmerged branch — the
      refusal is not the first place the truth surfaces
- [ ] The honest options are **considered and recorded**, not assumed: reconcile claims from
      open branches (e.g. via `arggon sync`, which already reads open PRs); OR make the claim
      commit land somewhere shared; OR make the ranking surface declare the branch it ranked from.
      Whichever is chosen, `next` must not silently rank from `main` alone
- [ ] `arggon sync --json` (or the chosen surface) surfaces branch-resident claims explicitly —
      an agent can tell "unclaimed" from "claimed on a branch I have not merged"
- [ ] A regression test: an item claimed on a branch, with `main` untouched, is not reported
      claimable — and the test is hermetic (no network, no real `gh`)
- [ ] `docs/agents.md` §Claim states which copy is authoritative while a claim is in flight, so
      an agent knows that `show` from the primary can legitimately disagree with the branch
- [ ] The four held items above are re-read through the fixed surface and confirmed held; no
      claim is stolen to make the pool look clean
- [ ] Decided whether a stale claim on a **never-merged** branch is reclaimable at all — today
      it is invisible to `--stale`, so a crashed writer's claim can outlive the branch

## Notes
