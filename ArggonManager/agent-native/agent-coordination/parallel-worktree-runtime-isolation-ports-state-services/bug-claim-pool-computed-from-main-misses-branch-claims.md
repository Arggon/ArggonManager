---
type: bug
status: in_progress
id: bug-claim-pool-computed-from-main-misses-branch-claims
title: "`list`/`next` compute the claimable pool from `main`, but a claim made in a worktree rides its branch — so every in-flight item reads `todo`/unassigned on main and is offered to an agent that `start` then refuses"
assignee: arggon-delivery-lead
branch: fix/bug-claim-pool-computed-from-main-misses-branch-claims
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [tracker-schema, worktree, hygiene, claims]
created: "2026-10-05"
updated: "2026-10-15"
claimed_at: "2026-10-15T12:11:26.525Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-claim-pool-computed-from-main-misses-branch-claims
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

### 2026-10-15 @arggon-maker
Acceptance evidence — expected vs observed, per box. Fix branch `fix/bug-claim-pool-computed-from-main-misses-branch-claims` (commit `f2edb791`), PR to follow. Route: `next`/`list` declare the ranked-from checkout (`rankedFrom`); `sync` reconciles branch-resident claims (`branchClaims`/`branchClaimErrors`). The two rejected options (ranking read reconciles branches itself; shared claim commit) are recorded with reasoning in the PR body.

**Box 1 — the pool no longer advertises a branch-held item silently; the refusal is not the first place the truth surfaces.**
Expected: the ranking surface names the tree it ranked from and the branch-claims boundary; `sync` reports the held item before any `start`.
Observed (live, primary checkout, fixed CLI read-only): `next --json` → `rankedFrom {branch:"main", head:"221a8b60", note:"claims made on unmerged branches are not visible from this tree; run \`arggon sync\` to surface branch-resident claims"}`; the human output prints the same line. `sync --json` from the same tree reports 5 branch-resident claims, each `local:{status:"todo",assignee:null}` — including the item `next` suggested (`task-friction-surface-parity-and-docs`). So the hold is visible before `start`, and `next` no longer ranks from `main` silently. Recorded decision: `next` does not filter locally-visible branch claims — a filter would be incomplete (unfetched branches/other machines) and would hide the boundary instead of declaring it; `sync` is the reconciliation surface and `docs/agents.md` §Claim now makes the `sync` check part of claiming.

**Box 2 — options considered and recorded.**
PR body records: (1) ranking read reconciles branches itself — rejected (hot path; still incomplete without a fetch/network; adds a hidden second input to the pool); (2) shared claim commit — rejected (the claim IS the item frontmatter, the single source of truth the kernel refuses on; a second store duplicates state and writing claims to `main` bypasses the branch model); (3) chosen: declare `rankedFrom` + reconcile in `sync`.

**Box 3 — sync surfaces branch-resident claims explicitly.**
`sync --json` gains `branchClaims: [{id, branch, pr, assignee, claimed_at, local:{status,assignee}}]` and `branchClaimErrors: [{id, branch, pr, reason}]` (not fetched / unreadable frontmatter / missing id → claim state UNKNOWN, never "unclaimed"). Human output prints `branch-claim:` lines + the hold hint. Report-only: never gates matching or `exit_code` (asserted). Reads are local git only (`git show <ref>:<path>`, refs `refs/heads` + `refs/remotes/origin` + open-PR head names) — no extra network. Documented in `docs/json-output.md` §sync.

**Box 4 — hermetic regression test (no network, no real `gh`).**
`cli/src/sync-command.test.ts` "reports a claim on an unmerged branch while main's copy stays todo": real temp git repo, stubbed `gh`, claim committed on `feat/task-held`, `main` untouched → `branchClaims` reports the item as branch-held and the local copy stays `todo`/unassigned (asserted byte-shape). Unit coverage `lib/src/branch-claims.test.ts` (11 tests: origin-ref fallback, unreadable/missing-id/no-id branches, local-claimed/terminal/different-id skips, non-git tree). End-to-end spawned CLI + fake gh: `cli/src/sync-smoke.test.ts`. `list`/`next` declaration tests: `lib/src/next.test.ts`, `lib/src/list.test.ts`, `cli/src/cli.test.ts`.

**Box 5 — docs/agents.md §Claim states which copy is authoritative.**
Added to §2 Claim: the branch's copy is authoritative from claim until merge (`status`, `assignee`, `claimed_at`, `branch`, `worktree_path` ride it); `show` from the primary legitimately answers `todo`; ranking envelopes name the checkout (`rankedFrom`); run `arggon sync` and read `branchClaims`/`branchClaimErrors` before treating a `todo`/unassigned item as claimable; never force or steal. `docs/json-output.md` documents the new `list`/`next`/`sync` rows and the tree-declaration/branch-claims paragraphs.

**Box 6 — the four held items re-read through the fixed surface; no claim stolen.**
Observed: all four merged on 2026-10-06 (`gh pr view`: #620, #619, #618, #586 all MERGED) and read `done` on `main` — they are no longer held, so "confirmed held" is not reproducible today; recorded as observed rather than repeated. The fixed surface correctly excludes terminal items from `branchClaims` (branch claims on closed work are history). The live held set instead: `sync` reports 5 branch-resident claims — this item, `bug-prover-agent-has-no-x-generated-entry`, `task-decide-codebase-memory-default-discovery`, `task-foreign-writes-char-clip-truncated` (#838), `task-friction-surface-parity-and-docs` — all `local:{status:"todo",assignee:null}`. No claim was modified, released or stolen: `main`'s copies stayed byte-identical (`git status` clean) and the branch copies are untouched (write-mode test asserts the branch copy still carries `status: "in_progress"`).

**Box 7 — decided: is a stale claim on a never-merged branch reclaimable?**
Yes, but only through the human-only takeover gate and only where the claim lives. `sync` now makes it visible (`branchClaims` carries `claimed_at`; `branchClaimErrors` says when the branch could not be read); releasing/taking over happens on the branch's worktree copy via the interactive `update --steal --reason "..." --assignee <you>` (repo armed with `x-tracker.allow-steal: true`). Agents never steal; `list --stale` still cannot report it (it reads one tree and the claim is not in that tree). Live: `task-decide-codebase-memory-default-discovery` claimed `2026-10-03T02:50:07Z` on `feat/task-decide-codebase-memory-default-discovery`; from `main`, `list --stale --older-than 7d --json` → `[]`; from the item's own worktree the same read reports it stale; `sync` from `main` reports it with `claimed_at`. Recorded in `docs/json-output.md` §sync.

**Gates, from this worktree.**
`npm run arggon -- validate --json` → `{"ok":true,...,"errors":[],"warnings":[]}`; focused suites (branch-claims 11, list, next, sync-types, sync-command 21, sync-smoke 5, cli, mcp-parity, lib-build, tools, measure, acceptance-convention, decision-brief-convention) green; `npm run lint` clean; `npm run test:structure` 5/5 PASS; `npm run check:plugin` exit 0 (bundle regenerated, deterministic); `npx prettier --check` on every touched file clean. Full `npm test`: **161 files / 3543 tests passed** (clean run, tree committed, no concurrent writes). A full-suite failure seen on an earlier intermediate run (`cli/src/prose-format.test.ts` code-span test timing out at 30s) is the pre-existing load flake tracked as `bug-prose-format-codespan-test-times-out-under-full-suite`; it passes standalone and in the final run.
