# 0003 Milestone field for convention v3

- Status: Proposed
- Date: 2026-09-11
- Deciders: Software Architect (author), Project Manager, Software Developer (aware)

## Context

Story `story-milestones` (epic: reporting) needs a milestone concept for v3:
backlog milestones and roadmap targets give work a deadline frame. The task
(`task-milestone-design`) asks for field semantics — especially dates on
initiatives/epics — interaction with `x-*` extensions, and validation.

Constraints from [`docs/convention.md`](../convention.md):

- The reserved-for-later list (`order`/`rank`, `depends_on`/`blocked_by`,
  `priority`, `estimate`) does **not** contain `milestone` — the name is free.
- The v0 → v1 (`branch`) and v1 → v2 (`branch_patterns`) precedents are purely
  additive: older trees stay valid, `validate` rejects only versions newer than
  it supports.
- Dates already have an established shape: quoted `YYYY-MM-DD`, format-checked
  by `validate` for `created`/`updated` (regex only, no calendar check).
- Container status is authored, never rolled up — v3 must not introduce derived
  fields through the back door.

## Decision

**v3** = v2 + one official optional field, **`milestone`**, on **all** work-item
types:

| Aspect | Rule |
| --- | --- |
| Type | `string \| null`; omit or `null` = no milestone |
| Shape | Quoted `YYYY-MM-DD` target date (same shape as `created`/`updated`) |
| Empty string | Invalid (same rule as `assignee`) |
| Scope | Permitted on every type; most meaningful on initiatives/epics (roadmap targets) |
| Rollup | None — a milestone constrains only its own item; no inheritance to children, no rollup to parents (consistent with status independence) |
| JSON contract | Additive `milestone: string \| null` on `WorkItem` within `schemaVersion: 1` (same treatment as `branch` in v1) |

Validation (`INVALID_MILESTONE`): present values must match
`^\d{4}-\d{2}-\d{2}$`, exactly like `created`/`updated`. Deliberately
format-only — no calendar check (month 13 fails nowhere, just as today);
`validate` stays a shape checker, not a calendar.

`x-*` interaction:

- `milestone` is official, so it is **not** part of the `x-*` namespace.
- Existing `x-milestone` (or `extensions.milestone`) keys keep working as
  before: ignored by readers, round-tripped by `update`, never validated.
- Tools MUST NOT conflate `x-milestone` with `milestone`. Adopting the
  official field from an `x-*` key is an explicit manual edit, never a silent
  merge.

Migration v0 → v3: nothing is required. v0/v1/v2 trees remain valid with and
without `milestone`. `init` scaffolds new trees at v3. Suggested CLI surface
for the implementation wave (non-normative here): `create`/`update`
`--milestone <YYYY-MM-DD>` (empty clears, mirroring `--branch`), `list`
filter, board grouping behind a flag (see `task-milestone-board`).

## Consequences

- Reporting can rely on a canonical, validated target date instead of
  unenforceable `x-*` keys.
- Kernel cost is one optional field reusing the date-shape precedent — no new
  version-gating branches beyond the existing `CONVENTION_VERSION` bump.
- No rollup semantics to maintain; a future "milestone rollup/report" needs
  its own ADR.
- `update --milestone` on an in-progress claim follows the existing claim
  rules unchanged (milestone is orthogonal to status/assignee).

## Alternatives considered

- **`x-milestone` only, no official field**: zero schema change, but readers
  must ignore unknown namespaced keys — `validate` and reporting could never
  rely on it. Rejected: defeats the story's purpose.
- **Start/end range pair** (`milestone_start`/`milestone_end`): `created` /
  `updated` already frame the past; one target date is the minimal deadline
  frame. Ranges deferred to a later ADR if reporting needs them.
- **Containers only** (initiative/epic): matches "roadmap targets" intuition,
  but per-type allow-lists complicate the kernel for no validation benefit
  (uniformity follows the `branch` precedent). Rejected.
- **Derived milestone** (nearest dated ancestor): violates the no-rollup rule
  and makes `validate` order-dependent. Rejected.
