---
type: task
status: in_progress
id: task-strict-attach-dead-owner-hatch
title: "Strict worktree-write gate: recovery hatch when the stamped owner session is dead"
assignee: Arggon
branch: feat/task-strict-attach-dead-owner-hatch
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, opencode-seam]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T03:24:55.350Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-strict-attach-dead-owner-hatch
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-strict-attach-dead-owner-hatch.md
  Leaves live only under a story. id is the filename stem: task-strict-attach-dead-owner-hatch.
  CLI `arggon create task strict-attach-dead-owner-hatch` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Strict worktree-write gate: recovery hatch when the stamped owner session is dead

## Context

Single-writer enforcement (#568) stamps every `start --worktree` in the
worktree's git dir and, on an attach by a different identity over tracked writes,
reports a fired `claim.foreignWrites` detection — report-only by default, an
attach REFUSAL under `x-tracker.strict-worktree-writes: true` (before any item
mutation). Two invariants must not regress: a fired detection never re-stamps
the worktree (anti-unlock), and the manual recovery
(`rm <git-dir>/arggon-claim.json`) stays documented and named in the refusal.

The gap: a CRASHED stamped session makes every new session "foreign" by session
id, so under strict a legitimate recovery is refused and the message's "have it
re-attach" remedy is impossible — the only escape today is deleting the stamp by
hand, which throws away the ownership record.

## Acceptance

- [x] The manual recovery step stays documented — verified in
      `ArggonManager/docs/convention.md` (claim stamp bullet), `agents.md` (§4
      single-writer ownership) and the refusal message in
      `lib/src/worktree.ts` (`strictWorktreeWriteFailure`); none removed.
- [x] A designed hatch, minimal and default-OFF — **decision: (a) an explicit
      take-over flag on start** (`arggon start <id> --worktree
      --take-over-worktree`), implemented kernel-first (see the Notes entry
      below for the mechanism and the rationale). Not (b), a stale-stamp window.
- [x] Tests pin the hatch: the dead-owner scenario takes over and records a
      dated receipt naming the replaced stamp; live-owner refusals are unchanged
      (still refused without the flag, still re-detect on retry, still never
      re-stamp); the strict report-only default is unchanged; a direct kernel
      caller that passes no `deps.claim` still gets the legacy receipt shape.

## Notes

### 2026-10-02 @Arggon — decision: explicit take-over flag, not a stale-stamp window

**Chosen: (a) `start --take-over-worktree` — an explicit, per-invocation,
opt-in take-over that records a dated takeover in the receipt naming the stamp
it replaced.** Default OFF; kernel-first in `lib/src/worktree.ts` so CLI and
native share the mechanism.

**Why not (b) a stale-stamp window** (`claimedAt` older than N auto-expires):
single-writer enforcement must never have a clock-based self-unlock. A
legitimate long session — a big refactor with a day of uncommitted work, a
paused overnight session, an agent that lost its clock — is exactly what a
window silently steals, and it does so at the worst moment: while the work is
dirty and uncommitted. The window also cannot answer the question the refusal
actually asks ("is there a live writer?"), it only guesses from age. A flag
keeps a human (or the coordinator) in the loop at the moment the evidence is on
screen, and leaves a dated record of who decided the previous owner was dead —
which is the audit trail the incident needs. Cost of the choice: the operator
must notice the dead session, which is a cost we accept; the manual `rm` stays
documented for when they cannot.

**Mechanism (kernel-first, `lib/src/worktree.ts`):**

- `WorktreeClaimRequest.takeOver?: boolean` — default OFF. A caller with no
  flag produces a byte-identical receipt and stamp.
- On a FIRED detection, the existing anti-unlock branch (keep the previous
  stamp, report `foreignWrites`) is unchanged **unless** `takeOver` is set.
  With it, this run's stamp is written and carries a bounded, dated
  `takeovers` chain (`MAX_CLAIM_TAKEOVERS`) whose newest entry names the
  replaced stamp (`identity`, `item`, `branch`, `claimedAt`, `assignee`).
- The receipt gains `takeOver: { takeover, files, total }` — the same evidence
  the detection saw, in the same bounded shape. The fired evidence is
  deliberately moved OUT of `foreignWrites` on a take-over: both surfaces'
  strict gate already reads `claim.foreignWrites`, so an authorized take-over
  is resolved with **zero surface change** and the native tool benefits from
  the shared kernel without touching `opencode/plugins/arggon/index.ts`.
  Nothing is hidden — the evidence is in the receipt and the stamp chain, and
  the CLI prints a loud `note: single-writer take-over — …` line.
- `worktreeTakeoverWarning(receipt)` renders the bounded loud sentence.
- The refusal message keeps every existing clause (including the manual `rm`
  recovery) and gains the flag as the audited middle step, conditional on
  confirming the stamped session is gone.
- A take-over with nothing to take over from (same identity, no newer writes,
  no prior stamp) is a no-op: no record, normal stamp refresh.
- An unwritable git dir degrades the take-over to an unrecorded one
  (`stamped: false` + warning) and never throws — the previous stamp stands, so
  the next attach re-detects the same evidence.

**Native gap (open question for the coordinator):** the kernel honors
`takeOver`, but the native `start` tool has no input field to set it, and
`opencode/plugins/arggon/index.ts` is owned by a sibling worker on
task-nativeCleanup Compose parity. Wiring is a one-argument pass-through in
`index.ts`; until then the native surface keeps the manual `rm` recovery.

### 2026-10-02 @Coordinator
### 2026-10-01 @Coordinator
Filed from the #568 review: under `x-tracker.strict-worktree-writes`, a crashed stamped session makes every new session 'foreign' by session id, and the refusal's own remedy ('have it re-attach') is impossible — the documented manual recovery is removing `<git-dir>/arggon-claim.json` by hand.

## Acceptance
- [ ] Document the manual recovery step in convention.md + agents.md (in the #568 docs touch or this item's PR).
- [ ] Decide + implement a designed hatch: e.g. `start --take-over-worktree` (records a dated takeover receipt naming the replaced stamp), or a stale-stamp window (claimedAt older than N days auto-expires with a warning).
- [ ] Tests: dead-owner scenario pins the hatch; live-owner refusals unchanged.

### 2026-10-02 @ses_f055b7ab0ffeYscgHIY6455maW
Implemented on `feat/task-strict-attach-dead-owner-hatch` (worktree `/home/arggon/Projects/ArggonManager-task-strict-attach-dead-owner-hatch`).

**Decision: (a) explicit take-over flag — `arggon start <id> --worktree --take-over-worktree`.** Rejected (b) a stale-stamp window: a clock-based self-unlock silently steals a long-but-live session's uncommitted work (long refactor, paused overnight session, lost clock) exactly while the work is dirty, and age cannot answer the question the refusal actually asks ("is there a live writer?"). A flag keeps a human in the loop where the evidence is on screen and leaves a dated record of who decided the previous owner was dead.

**Mechanism (kernel-first, `lib/src/worktree.ts`):** `WorktreeClaimRequest.takeOver` (default OFF). On a FIRED detection the anti-unlock branch is unchanged unless the flag is set; with it the run re-stamps and records a dated take-over — receipt `claim.takeOver = { at, by, replacedIdentity, replacedClaimedAt, replaced, files, total }` plus a bounded `takeovers` chain (newest 5, one entry per taker) persisted in the new stamp. The fired evidence deliberately moves OUT of `claim.foreignWrites`, so both surfaces' strict gate (which reads exactly that field) is resolved with zero surface change and the native tool inherits the kernel mechanism without touching `opencode/plugins/arggon/index.ts`. `worktreeTakeoverWarning` renders the loud stdout note. The refusal message keeps every existing clause (including the manual `rm`) and names the flag as the audited middle step.

**Default identity (#533 discipline), pinned by tests:** no flag → receipt `{ stamped: true }` byte-identical; a refused attach leaves the previous stamp's bytes untouched (no `takeovers` key anywhere); a kernel caller passing no `deps.claim` keeps the legacy receipt shape; a take-over with nothing to take over from is a no-op; live-owner refusals still refuse, still re-detect on retry and still never re-stamp.

**Gates (all green in the worktree):** `npm test` 2122 passed / 116 files, `npm run lint`, `npm run build`, `npm run check:plugin`, `npm run smoke:native-start-cold` (passed), `npm run arggon -- validate` → `ok (0 warnings, convention v5)`, prose-format clean.

**Open question for the coordinator:** the native `start` tool has no input field for the take-over; wiring is a one-argument pass-through in `opencode/plugins/arggon/index.ts` (owned by the sibling worker on task-nativeCleanup Compose parity) plus the `preparation.claim` bounded mapping forwarding `takeOver`. Until then the native surface keeps the manual `rm` recovery, which is documented in agents.md as path (2).

### handoff 2026-10-02 @ses_f055b7ab0ffeYscgHIY6455maW (session: ses_f055b7ab0ffeYscgHIY6455maW) — next: Review + merge PR #573 (draft): explicit --take-over-worktree hatch, kernel-first; then file/wire the native start takeOver input (index.ts, sibling-owned lane)
- branch: feat/task-strict-attach-dead-owner-hatch
- open questions: native start has no takeOver input field — one-arg pass-through in index.ts + preparation.claim mapping; should the coordinator file that task or fold it into the sibling's PR?
