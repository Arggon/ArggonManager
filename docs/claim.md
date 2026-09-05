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

## Unclaim recovery

v0 unclaim: `in_progress` → `todo` clears `assignee` (CLI `update` default).

```bash
arggon update <id> --status todo
# then
arggon update <id> --status in_progress --assignee <you>
```

## Stale claims

Optional later: warn when `updated` is older than N days. **Deferred** — not enforced in v0.

## Claiming (playbook)

Agents and humans follow the same rules:

1. Claim before starting (`--status in_progress --assignee <you>`).
2. Do not steal; unclaim or use `--force` only when coordinated.
3. Unclaim when releasing work (`--status todo`).
4. Do not reopen `done`/`cancelled` as an agent (schema may allow; see convention reopen policy).

Longer loop (find → claim → work → PR): [`agents.md`](agents.md). Prefer that playbook for the full agent workflow; keep claim/concurrency rules here.
