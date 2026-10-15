---
type: task
status: in_progress
id: task-clip-class-sweep-remaining-sites
title: "Clip-order class sweep: `cli/src/board.ts:141` and the kernel `gh auth status` wrappers (`lib/src/get-open-prs.ts:67`, `import-issues.ts:187`, `cleanup.ts:259`) still append their remedy after the detail"
assignee: arggon-delivery-lead
branch: feat/task-clip-class-sweep-remaining-sites
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cli, native-seam]
created: "2026-10-03"
updated: "2026-10-15"
claimed_at: "2026-10-15T15:08:55.703Z"
depends_on: [task-cli-start-remediation-tail-clipped-on-human-channel, bug-three-acceptance-parsers-diverging]
worktree_path: /home/arggon/Projects/ArggonManager-task-clip-class-sweep-remaining-sites
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-clip-class-sweep-remaining-sites.md
  Leaves live only under a story. id is the filename stem: task-clip-class-sweep-remaining-sites.
  CLI `arggon create task clip-class-sweep-remaining-sites` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Clip-order class sweep: `cli/src/board.ts:141` and the kernel `gh auth status` wrappers (`lib/src/get-open-prs.ts:67`, `import-issues.ts:187`, `cleanup.ts:259`) still append their remedy after the detail

## Context

Class sweep left open by the worker on PR #608
(`task-cli-start-remediation-tail-clipped-on-human-channel`), 2026-10-03. That
PR fixed four sites and recorded the ones it deliberately did NOT touch,
because they belong to other items or surfaces. Same defect class: an
actionable remedy appended AFTER the detail, so a head-kept clip eats the
remedy first.

The repeated shape worth naming: four PRs (#573, #579, #595, #597, and now
#608) each fixed one or two call sites, and each time a reviewer or worker
found the _next_ site. That is what a class defect looks like from inside a
per-site workflow — and the reason this item exists rather than another
one-line reorder.

Round-2 review of PR #608 found a site in the SAME class that was never
enumerated (2026-10-03), and corrected the deferral list with the reviewer's
own arithmetic — both recorded here because they change what "the class"
means:

- **New site: `worktreeRemediation`'s `committing the claim` branch**
  (`cli/src/start.ts:762-767` as filed, added by #517) still appended the exact fix AFTER an **uncapped** readiness bin list (`Exact fix: run \`npm ci\` in <worktree>`).
On the committed worst-case fixture the reviewer's arithmetic put the exact
fix at ~3201 in a 3687-char message — clipped away entirely (index -1), with
the discard hint going with it. #573, #579, #595, #597 and #608 each
reordered a site and never touched this one: the sharpest evidence yet that
this item is a class sweep, since the sixth site was found by none of the
five PRs. The branch that actually creates the worktree (`committing the claim`) is on the most common start path. Pointer for the worker: at
HEAD the exact fix leads and only the readiness evidence is budget-bounded
(`cli/src/start.ts` `worktreeRemediation`/`worktreeFailureMessage`;
commits `1446ca08`, `bffe586f`, `6e8995c2`) — verify, do not assume.
- **The four deferred sites are provably NOT clip-reachable** — stderr is
  `ignore`d there, so `err.message` is a bounded argv echo. `cli/src/board.ts:141`
  (owned by `bug-three-acceptance-parsers-diverging`) and the three kernel `gh
auth status` wrappers (`lib/src/get-open-prs.ts:67`,
  `lib/src/import-issues.ts:187`, `lib/src/cleanup.ts:259`) are NOT part of
  this class after all: record them compliant so nobody re-audits them.
- **Carrier drift travels with the fix:** `docs/convention.md:544` and
  `docs/json-output.md:475` (as filed) still documented the post-start error
  with the hint TRAILING while PR #608 shipped it leading. Pointer:
  `ArggonManager/docs/json-output.md` now documents the `readiness` row with
  the remedy leading and the evidence budget-filled — verify the wording at
  HEAD.
- **One ordering assertion was vacuous:** the `worktree.test.ts:557` (as filed)
  assertion searched lowercase `"if this is an identity error"`, which the new
  capitalized message no longer contains, so `indexOf` returned -1 and `-1 <
positive` always passed — the reorder real, the pin worth nothing. Check for
  the same pattern wherever a reworded message is asserted by substring.
  Pointer: repaired with presence-checked needles on both sides (commit
  `61449604`) — verify, and use that idiom on any site touched.
- **The pre-fix numbers do not reproduce** (`459 < 355` quoted in the item vs
  ~537 vs ~355 measured). The qualitative claim holds by construction; the
  recorded evidence must say so rather than keep a number that does not
  reproduce.

Already verified compliant by the PR #608 worker (recorded so the next sweeper
does not redo it): `assertStartableTree`, `git()`, the plain non-worktree
start, `cli/src/cleanup.ts` refusals (clamped at 500 on a machine surface), and
`mcp-server` `spawnedOutcome` (detail already last).

Reconciliation pointer: the sibling
`task-cli-start-remediation-tail-clipped-on-human-channel` is done through
round 3 — the fifth site landed and the four "same shape" deferrals were
corrected to not-clip-reachable there too. This item must reconcile with that
record, not re-claim a second "swept".

## Acceptance

- [ ] The `committing the claim` branch leads with the exact `npm ci` fix and bounds ONLY the readiness evidence by budget (verify the `1446ca08` / `bffe586f` / `6e8995c2` shape at HEAD, or re-fix if regressed); the worst-case arithmetic re-run on the current fixture, with the non-reproducing `459 < 355` numbers corrected to measured values and the qualitative claim kept by construction
- [ ] The four deferred sites (`cli/src/board.ts:141`, `lib/src/get-open-prs.ts:67`, `lib/src/import-issues.ts:187`, `lib/src/cleanup.ts:259`) recorded NOT clip-reachable (stderr ignored, bounded argv echo) — recorded compliant, not fixed, so nobody re-audits them
- [ ] The doc drift travels with the fix: the post-start error wording in `ArggonManager/docs/convention.md` and `ArggonManager/docs/json-output.md` states the hint LEADING (verify the `readiness`-row wording at HEAD, or fix the drift)
- [ ] Every ordering assertion pins with presence-checked needles on both sides (the `61449604` idiom: each needle asserted present before any index comparison) — the same idiom on any site this sweep touches, never a bare `-1 < n` comparison
- [ ] An ordering assertion or grep-able rule pins the ORDER convention (remedies lead, evidence trails) on every human-facing surface, so a future site cannot reintroduce it silently (extend the `e1381a40` / `assert-order.test.ts` coverage to each site touched)
- [ ] Reconciled with `task-cli-start-remediation-tail-clipped-on-human-channel` (done, rounds 1–3): no duplicate "swept" claim — every remedy-after-detail site on every human-facing surface enumerated and either fixed or recorded compliant

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Class sweep left open by the worker on PR #608 (task-cli-start-remediation-tail-clipped-on-human-channel), 2026-10-03. That PR fixed four sites and recorded the ones it deliberately did NOT touch, because they belong to other items or surfaces. Same defect class: an actionable remedy appended AFTER the detail, so a head-kept clip eats the remedy first.

**Deferred because the file belongs to a concurrent item:**

- `cli/src/board.ts:141` — identical violation. Owned by `bug-three-acceptance-parsers-diverging` (active now), so it must wait rather than collide.

**Deferred because they are kernel-side, different surface:**

- `lib/src/get-open-prs.ts:67`, `lib/src/import-issues.ts:187`, `lib/src/cleanup.ts:259` — the `gh auth status` wrappers. These are kernel surfaces whose text reaches humans through their own envelopes, so confirm the clipping bound and the remedy's position per surface rather than assuming the CLI's 2000-char clip applies.

**Already verified compliant by that worker** (recorded so the next sweeper does not redo it): `assertStartableTree`, `git()`, the plain non-worktree start, `cli/src/cleanup.ts` refusals (clamped at 500 on a machine surface), and `mcp-server` `spawnedOutcome` (detail already last).

The repeated shape worth naming in the eventual fix: four PRs (#573, #579, #595, #597, and now #608) each fixed one or two call sites, and each time a reviewer or worker found the _next_ site. That is what a class defect looks like from inside a per-site workflow — and the reason this item exists rather than another one-line reorder.

Acceptance:

- [ ] Every remedy-after-detail site on every human-facing surface is enumerated and either fixed or recorded compliant — no "swept" claim without the list
- [ ] `cli/src/board.ts:141` fixed (after the parsers item lands, so the two do not collide)
- [ ] The three kernel `gh auth status` wrappers fixed, each with the bound that actually applies to its surface
- [ ] A test or grep-able rule pins the ORDER convention so a future site cannot reintroduce it silently — the same outcome the seam-pin parity work aims at
- [ ] Depends on PR #608 for the board file, not for the kernel wrappers

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Round-2 review of PR #608 (task-cli-start-remediation-tail-clipped-on-human-channel) found a site in the SAME class that was never enumerated, 2026-10-03. Updating this item's scope with the reviewer's own arithmetic, because it changes what "the class" means.

**New site, not in the original deferral list.** `worktreeRemediation`'s `committing the claim` branch (`cli/src/start.ts:762-767`, added by #517) still appends `Exact fix: run \`npm ci\` in <worktree>` AFTER an **uncapped** readiness bin list. On the committed worst-case fixture the reviewer's arithmetic puts the exact fix at ~3201 in a 3687-char message — so it clips away entirely (index -1), and the discard hint goes with it. #573, #579, #595, #597 and #608 each reordered a site and never touched this one.

That is the sharpest evidence yet for why this item is a class sweep rather than another one-line reorder: five PRs found five sites, and the sixth was not found by any of them. The `committing the claim` branch is on the most common start path — the one that actually creates the worktree.

**Also from that review, folding into the eventual fix:**

- `docs/convention.md:544` and `docs/json-output.md:475` still document the post-start error with the hint TRAILING, while PR #608 ships it leading. Carrier drift in the same PR — must travel with it.
- One ordering assertion in `worktree.test.ts:557` is **vacuous**: it searches lowercase `"if this is an identity error"`, which the new capitalized message no longer contains, so `indexOf` returns -1 and `-1 < positive` always passes. The reorder is real but that test pins nothing. Worth checking for the same pattern wherever a reworded message is asserted by substring.
- The four sites previously deferred (`cli/src/board.ts:141`, `lib/src/get-open-prs.ts:67`, `import-issues.ts:187`, `cleanup.ts:259`) are **provably not clip-reachable** — stderr is `ignore`d there, so `err.message` is a bounded argv echo. Recorded so nobody re-audits them; they are NOT part of this class after all.
- The pre-fix numbers quoted in the item (`459 < 355`) do not reproduce (~537 vs ~355). The qualitative claim holds by construction; the recorded evidence should say so rather than keep a number that does not reproduce.
