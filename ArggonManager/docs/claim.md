# Claim / concurrency (v0)

Rules for humans and agents so two workers do not silently double-work the same item. Schema details live in [`convention.md`](convention.md) (Claim rule, Unclaim, statuses).

## Definition

**Claim** = (`type` ∈ {story, task, bug}) ∧ `assignee` set ∧ `status: in_progress`.

Initiative and epic may be `in_progress` without an assignee (container status, not a claim).

## Conflict

If an item is already claimed, `arggon update` **refuses** reassignment to a different assignee unless `--force`.

- Default: fail with a claim conflict (no silent steal).
- `--force`: allow reassignment; still enforce status transitions, the claim rule, and `blocked_reason` rules.

Coordinate first when possible. Prefer unclaim + reclaim over force.

## Concurrent claims (atomic check-and-set)

The claim is a read-modify-write of the item file, so it is guarded by a file
lock (`cli/src/lock.ts`, bug-claim-race-no-lock): `start` and claim-changing
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

v0 unclaim: `in_progress` → `todo` clears `assignee` (CLI `update` default).

```bash
arggon update <id> --status todo
# then
arggon update <id> --status in_progress --assignee <you>
```

## Stale claims (claim leases)

Every claim now carries a soft lease: the CLI maintains `claimed_at` (ISO date-time) — set when a claimable item is claimed, cleared when the claim is released. Staleness is **advisory reporting**, never enforcement:

```bash
arggon list --stale --older-than 7d   # claimed items whose lease is older than 7d
```

Items claimed before `claimed_at` existed count as stale (no lease recorded).

Reclaiming a stale claim is a **human-only supervised takeover** (BREAKING hardening, bug-cli-steal-not-gated: steal is now opt-in per repo and interactive — the unconditional flow before this change is gone):

```bash
arggon update <id> --steal --reason "owner left; taking over" --assignee <you>
```

The flow (both gates are required):

1. **Arm the repo once**: `x-tracker.allow-steal: true` in the tracker `.convention.yml` (default when absent: steal is refused with `steal is disabled in this repo (x-tracker.allow-steal: true in the tracker .convention.yml arms it)`).
2. **A human runs it in their terminal**: `--steal` requires an interactive stdin — scripts, CI, and agents (non-TTY) are refused with `--steal requires an interactive terminal (agents must not steal claims — `ArggonManager/docs/agents.md`)`, even with the repo armed and even with `y` piped in. In a TTY, the CLI asks `Steal '<id>' from '<current-assignee>'? [y/N]` and aborts on anything but y/yes. There is no `--yes` override — the prompt is the point.
3. As before: a non-empty `--reason` (recorded in the item body as a dated note) and `--assignee <you>` are required.
- Agents are refused (same playbook rule as `--force`) — they unclaim-and-reclaim through coordination instead, or pick another item.

## Claiming (playbook)

Agents and humans follow the same rules:

1. Claim before starting (`--status in_progress --assignee <you>`).
2. Do not steal; unclaim or use `--force` only when coordinated.
3. Unclaim when releasing work (`--status todo`).
4. Do not reopen `done`/`cancelled` as an agent — enforced: the MCP layer refuses agent callers, and the CLI requires an interactive-terminal y/N confirmation for `--status todo` on a `done`/`cancelled` item (see convention reopen policy).

Longer loop (find → claim → work → PR): [`agents.md`](agents.md). Prefer that playbook for the full agent workflow; keep claim/concurrency rules here.
