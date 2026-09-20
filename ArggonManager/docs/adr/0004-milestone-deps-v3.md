# 0004 Convention v3: milestone + dependency graph

- Status: Proposed
- Date: 2026-09-11
- Deciders: Software Architect (author), Project Manager, Software Developer (aware)

## Context

The `agent-native` initiative (initiative `agent-native`) needs two of the v0
reserved-for-later fields in one convention wave: `milestone` (already specified
by [ADR 0003](./0003-milestone-field.md) — quoted `YYYY-MM-DD` target date, all
types, no rollup) and `depends_on`/`blocked_by` (the dependency graph that turns
`arggon next` from id-order guessing into genuinely-unblocked suggestions, the
core of Beads/Task-Master-class planning).

Constraints from [`docs/convention.md`](../convention.md):

- Both names are reserved-for-later: adopting them officially requires a version
  bump; `milestone` has been prototype-legal (no `UNKNOWN_KEY` warning) since the
  ADR 0003 prototype wave.
- v0 → v1 (`branch`) and v1 → v2 (`branch_patterns`) precedents are purely
  additive; older trees stay valid.
- Container auto-completion (cascade) already exists and must stay orthogonal.

## Decision

**v3 = v2 + `milestone` (per ADR 0003) + dependency fields**, all additive:

| Aspect | Rule |
| --- | --- |
| `milestone` | Exactly as ADR 0003: `string \| null`, quoted `YYYY-MM-DD`, `INVALID_MILESTONE` on shape violations |
| `depends_on` | `string[]` of work-item ids this item waits for; empty/omitted = none |
| `blocked_by` | **Computed inverse view, never stored** — one source of truth, no sync bugs |
| Reference integrity | `validate` rejects unknown ids (`UNKNOWN_DEPENDENCY`) and self-references (`SELF_DEPENDENCY`) |
| Cycles | `validate` rejects dependency cycles (`DEPENDENCY_CYCLE`) — the graph is a DAG |
| Scope | `depends_on` permitted on all types; cross-initiative edges allowed (ids are globally unique) |
| JSON contract | Additive `depends_on: string[]` on `WorkItem` within `schemaVersion: 1` |

Semantics deliberately **advisory-only**:

- Dependencies never *block* an update: `arggon update <id> --status done` still
  works with open dependencies (humans may close out of order; the trail is in git).
- They gate **suggestions**: `arggon next` (and `next --ready`) ranks/skips items
  whose `depends_on` are not all terminal (`done`/`cancelled`).
- They do **not** interact with the container auto-completion cascade: a container
  whose subtree is terminal completes even if siblings elsewhere depend on its
  leaves. Two different graphs (containment vs dependency) with two different rules.
- Board renders open dependencies as card lines / edges (read-only).

Migration v0 → v3: nothing required. v0/v1/v2 trees stay valid. `init` scaffolds
new trees at v3. Suggested CLI surface (non-normative): `arggon update <id>
--depends-on "a,b"` (replaces the list, empty clears — mirrors `--labels`).

## Consequences

- `arggon next` becomes genuinely useful for long-running multi-agent projects.
- `validate` gains a graph pass (cheap: the tree is already fully loaded).
- ADR 0003 is folded into this decision: v3 ships both fields together, one
  migration story, one convention bump.

## Alternatives considered

- **Ship milestone and dependencies as separate version bumps (v3/v4)**: two
  migrations for one theme; both fields were specced together in the roadmap.
  Rejected.
- **Store `blocked_by` instead of `depends_on`**: symmetric, but the inverse view
  is derivable and storing both invites divergence. Rejected.
- **Enforce dependencies on update** (refuse `done` with open deps): breaks the
  "humans may close out of order" freedom and the git-native authored-status
  principle. Rejected — advisory gating stays in `next`.
