# 0006 Token/context efficiency: compact envelopes, `show` read path, `next`-first guidance, generated-docs budget

- Status: Accepted
- Date: 2026-09-14
- Deciders: Software Architect (author), Project Manager (aware)
- Research: [exploration-token-context-efficiency-001](../explorations/exploration-token-context-efficiency-001.md) (task-token-context-research)

## Context

Operating principle 3 (2026-09-14): agent tokens and context windows are a
priority. ArggonManager's agent-facing surfaces were measured on 2026-09-14
(numbers and method in the linked exploration):

- `list --json` over 136 items: **60.7 KB (~15.2k tokens)** — the dominant
  per-cycle cost. Six fields (`blocked_reason`, `milestone`,
  `worktree_path`, `issue`, `depends_on`, `labels`) are null/empty for
  ≥96% of items; always-emitted nulls cost ~15–20% of the payload.
- There is **no `arggon show <id>`**: agents read whole item files via the
  filesystem. Comments grow files ~226 B each, unbounded, paid on every read.
- `next --json` is 901 B vs 60.7 KB for `list` — a 67x gap for the common
  "give me one actionable item" need, but agent guidance doesn't steer there.
- `init --full` emits ~43.7 KB; SKILL.md (16.3 KB, duplicated in-tree at
  `skills/` and `.agents/`) and the generated AGENTS.md (3.7 KB) are the
  biggest per-session fixed reads.
- MCP `tools/list` is 4.7 KB once per session — real but not dominant.

Constraints: existing agents/scripts parse the `--json` envelopes
(docs/json-output.md); the CLI and MCP surfaces must stay in parity; item
files are the audit trail and must remain verbatim on disk.

## Decision

Adopt four directions, all landing via follow-up items (no product change in
the research item itself):

| # | Direction | Change | Expected saving | Risk |
| --- | --- | --- | --- | --- |
| 1 | **Compact envelopes by default** | `list`/`create`/`update`/`comment` JSON omits null/empty optional fields unless `--full`; `ok`, `schemaVersion`, `conventionVersion`, `command`, `id`, `path` always present; policy documented in docs/json-output.md | ~15–20% of every envelope (~2.3–3k tokens per `list --json` at 136 items) | LOW-MEDIUM: JSON consumers must tolerate missing keys; MitM mitigated by always-present core keys |
| 2 | **`next`-first agent guidance** | SKILL.md / generated AGENTS.md copy instructs agents to use `next --json` unless they need the full board | up to ~15k tokens per work-cycle | LOW: guidance only |
| 3 | **`show <id>` progressive disclosure** | New CLI command + MCP tool returning frontmatter and/or body; `--tail-comments N` bounds comment cost; disk storage stays verbatim | bounded reads (~0.5 KB instead of unbounded file); one round-trip instead of list+fs-read | MEDIUM: new surface, CLI/MCP parity tests required |
| 4 | **Generated-docs context budget** | Generated AGENTS.md target ≤2 KB with pointers into docs/; SKILL.md de-duplicated to one canonical copy; budget enforced by `validate` | ~400+ tokens/session for every adopter; ~4k tokens for dual-path skill resolution | MEDIUM: copy change with adoption implications |

Explicitly **rejected/deferred**:

- Storage-side comment truncation — rejected: destroys the audit trail; only
  the read path may bound cost (`--tail-comments N`).
- MCP description trimming — deferred: 4.7 KB once per session is not a
  dominant cost; revisit after 1–4 with a fresh measurement.

## Consequences

- Every `--json` envelope gets smaller immediately after (1); consumers that
  indexed strictly by key presence must switch to `key in obj` checks — this
  is a documented breaking-ish change within schemaVersion 1, mitigated by
  `--full` for exact-compatibility reads.
- Agents get a first-class single-item read path (3), removing the hidden
  filesystem contract as the only way to inspect an item.
- A measurable budget (4) makes context cost a reviewed property of generated
  docs, like lint rules are for code.
- Follow-up: each direction needs its own item (spec first for 3 and 4);
  re-measure all surfaces after 1–4 land to verify savings.
