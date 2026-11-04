# Claim / concurrency (v0)

Layer: **reference**. Read for concurrent-claim behavior; start the ordinary
workflow in [agents](./agents.md). Claim schema, conflicts and terminal-state
policy have one canonical home in [convention](./convention.md#claim-rule).

## Definition

See the [claim rule](./convention.md#claim-rule).

## Conflict

See [claim conflict policy](./convention.md#claim-rule)
and the [human-only authority map](./engineering.md#roles-and-authority).

## Concurrent claims (atomic check-and-set)

The claim is a read-modify-write of the item file, so it is guarded by a file
lock (`lib/src/lock.ts`, bug-claim-race-no-lock): `start` and claim-changing
`update` runs take an exclusive-create lock (in `os.tmpdir()`, keyed by the
item's absolute path) around read → verify → write. Locks older than 60s are
broken automatically (a crashed process cannot wedge the tracker); a contender
that cannot acquire the lock within 10s fails with an actionable error instead
of racing.

Resulting semantics for simultaneous `arggon start` processes on one item:

- **Same assignee**: serialized by the lock — exactly one run creates the
  branch/worktree (`created: true`), the others see the claimed state and
  attach (`created: false`). Deterministic; two processes never write the same
  worktree simultaneously.
- **Different assignees**: exactly one wins; the others read the claimed state
  and fail with the claim-conflict `START_FAILED`. The claim is never silently
  replaced (no last-write-wins).

## Unclaim recovery

Read [unclaim and release](./runbooks/agent-recovery.md#unclaim) when abandoning
a claim or removing its remaining worktree footprint.

## Stale claims (claim leases)

Read the [canonical lease contract](./convention.md#claim-lease-claimed_at)
for staleness, reporting and supervised takeover.

## Claiming (playbook)

Agents claim with [start and a worktree](./agents.md#4-branch-and-worktree), never a bare-update checklist; the [canonical workflow contract](./agents.md#canonical-workflow-contract) also names the single-checkout human path. [Operational done](./agents.md#5-done-criteria) includes the actual merge, not just a status flip.
