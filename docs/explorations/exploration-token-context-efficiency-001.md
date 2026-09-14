---
exploration_id: token-context-efficiency-001
title: Token/context efficiency of agent-facing surfaces
status: open
created: 2026-09-14
---

# Exploration: token/context efficiency (token-context-efficiency-001)

Operating principle 3 (task-token-context-research): agent tokens and context
windows are a priority. Every byte an agent must read costs context; every
avoidable round-trip costs tokens. This exploration MEASURES the agent-facing
surfaces of ArggonManager as of 2026-09-14 (repo @ 890b6b1), then proposes
ranked optimizations. Token estimates use the rough ~4 chars/token heuristic.
The decision lands in ADR 0006.

## Measurements (2026-09-14, worktree feat/task-token-context-research)

### Static docs an agent reads in THIS repo (dogfood)

| Surface | Bytes | ~Tokens |
|---|---|---|
| AGENTS.md (shim + pointers) | 1,559 | ~390 |
| CLAUDE.md shim | 58 | ~15 |
| docs/agents.md | 23,360 | ~5,840 |
| docs/convention.md | 35,844 | ~8,960 |
| docs/engineering.md | 7,909 | ~1,980 |
| skills/arggon-cli/SKILL.md | 16,201 | ~4,050 |
| .agents/skills/arggon-cli/SKILL.md (duplicate) | 16,265 | ~4,065 |

Note: SKILL.md is shipped twice in-tree (skills/ and .agents/) at ~16.2 KB
each; an agent that loads the skill pays ~4.1k tokens.

### What a fresh adopter gets (`arggon init --full` into a throwaway tree)

| File | Bytes | ~Tokens |
|---|---|---|
| AGENTS.md (generated) | 3,696 | ~925 |
| docs/convention.md (generated) | 4,136 | ~1,035 |
| docs/engineering.md (generated) | 1,772 | ~445 |
| .agents/skills/arggon-cli/SKILL.md | 16,265 | ~4,065 |
| CONTRIBUTING.md | 1,693 | ~425 |
| ARCHITECTURE.md | 1,719 | ~430 |
| tasks/.convention.yml | 3,857 | ~965 (agents rarely read fully) |
| templates/ (8 files) | 4,576 | ~1,145 |
| everything else (SECURITY, SUPPORT, CHANGELOG, .github/, docs/tracking.md, runbooks README, .editorconfig, .mcp.json, CLAUDE.md) | ~5,068 | ~1,270 |
| **Total tree** | **43,694** | **~10,900** |

The single biggest generated artifact is SKILL.md (~37% of the tree); the
generated AGENTS.md (3.7 KB ≈ 925 tokens) is read by every agent session.

### `--json` envelopes (real runs in this repo)

| Command | Bytes | ~Tokens |
|---|---|---|
| `list --json` (136 items) | 60,667 | ~15,170 |
| `next --json` | 901 | ~225 |
| `doctor --json` | 309 | ~77 |
| `comment <id> --json` (envelope) | 291 | ~73 |
| `init --json` (envelope) | 886 | ~222 |

Null/empty-field analysis of the 136-item `list --json` payload:

| Field | Null/empty | Notes |
|---|---|---|
| blocked_reason | 136/136 (100%) | only meaningful when status=blocked |
| milestone | 136/136 (100%) | feature mostly unused today |
| worktree_path | 136/136 (100%) | only for claimed items with a worktree |
| issue | 136/136 (100%) | GitHub PR/issue link, rarely present |
| depends_on | 135/136 (99%) | usually `[]` |
| labels | 130/136 (96%) | usually `[]` |
| claimed_at | 123/136 (90%) | only for claimed items |
| branch | 59/136 (43%) | only for claimed/in-progress items |
| assignee | 16/136 (12%) | only for claimed items |
| parent | 3/136 (2%) | mostly null for initiatives |

Serialization cost of always-emitted null/empty fields ≈ 15–20% of the
list payload (~9–12 KB ≈ 2.3–3k tokens per full `list --json` in this repo,
which grows linearly with item count).

### MCP tool descriptions (tools/list via runMcpServer)

| Tool | JSON bytes | description bytes |
|---|---|---|
| arggon_list | 1,258 | 150 |
| arggon_create | 955 | 154 |
| arggon_update | 1,665 | 270 |
| arggon_comment | 833 | 406 |
| **tools/list total** | **4,726** | ~1,180 tokens, paid once per MCP session |

### Item files with comments

A fresh `task` file is 330 B. After 10 comments (~190 chars each) the same
file is 2,591 B — ~226 B (~57 tokens) per comment including the header line.
There is NO `arggon show <id>` command today: agents that need one field (or
the latest comment) must read the whole file via the filesystem, and the cost
grows unboundedly with comment count. An agent following the loop (list →
read item file → update → comment) pays roughly: 15.2k (list) + item body +
envelopes ≈ 16–20k tokens per cycle in a 136-item repo, of which well under
1k is strictly needed.

## Candidates

- **C1 Compact JSON envelopes** — omit null/empty fields by default
  (`issue`, `worktree_path`, `blocked_reason`, `milestone`, empty
  `labels`/`depends_on`); opt back in with `--full`.
- **C2 `show <id>` read path** — `arggon show <id>` (frontmatter + body,
  with `--body`, `--meta`, `--tail-comments N` options) so agents stop
  reading whole files and stop re-deriving ids from `list`.
- **C3 `next` as the default agent entry point** — steer agents to
  `next --json` (901 B) instead of `list --json` (60.7 KB) when they need
  one actionable item; document in SKILL.md/AGENTS.md copy.
- **C4 Generated-docs context budget** — shrink the init AGENTS.md
  (~3.7 KB) to a short pointer file; trim SKILL.md (~16.3 KB, duplicated
  in-tree); set an explicit byte budget for generated docs.
- **C5 MCP description trimming** — the 4.7 KB tools/list is modest; only
  trim if C1–C4 land and the budget review flags it.
- **C6 Comment truncation/summaries** — cap or summarize old comments in
  `show` output rather than changing what is stored on disk.

## Criteria

- Context savings per agent work-cycle (the loop above), weighted highest.
- Risk of breaking existing agents/scripts that parse envelopes or files.
- Information loss (must not hide state an agent needs to act safely).
- Implementation size (this principle favors cheap, surgical changes).

## Findings

- `list --json` dominates the per-cycle cost: 60.7 KB (~15.2k tokens) for
  136 items, measured 2026-09-14 (this repo, `npm run arggon -- list --json`).
- 6 fields are null/empty for ≥96% of items
  (blocked_reason, milestone, worktree_path, issue, depends_on, labels);
  serialization of always-emitted nulls ≈ 15–20% of payload (measured via
  per-field JSON dump, 2026-09-14).
- `next --json` returns 901 B (~225 tokens) — a 67x reduction vs `list`
  for the common "give me one item" agent need (measured, 2026-09-14).
- `init --full` emits ~43.7 KB total; SKILL.md alone is 16.3 KB and is
  duplicated in-tree at skills/ and .agents/ (measured, 2026-09-14).
- Comments grow the item file ~226 B each; no `show` command exists, so
  comment history is paid on every file read (measured, 2026-09-14).
- MCP tools/list is 4.7 KB (~1.2k tokens) once per session — not the
  dominant cost (measured via runMcpServer, 2026-09-14).

## Recommendation

Ranked, split into quick wins vs structural:

### Quick wins (low risk, immediate savings)

1. **C1 — compact envelopes by default** (touches: cli/src json/list output,
   MCP tool text). Omit null/empty fields listed above unless `--full`.
   Expected savings: ~15–20% of every `list --json` (~2.3–3k tokens per
   list in a 136-item repo), plus similar shrinkage of create/update/comment
   echoes. Risk: LOW-MEDIUM — JSON consumers must tolerate missing keys;
   mitigate by keeping `ok/schemaVersion/command/id/path` always present and
   documenting the policy in docs/json-output.md. Follow-up item required.
2. **C3 — `next` as the documented agent entry point** (touches: SKILL.md
   copy, docs/agents.md guidance). Expected savings: up to ~15k tokens per
   work-cycle for agents that don't need the full board. Risk: LOW — no
   code change; behavior guidance only. Do inside the C1/C2 follow-ups.
3. **C4a — SKILL.md de-duplication** (touches: skills/, .agents/ — outside
   this item's file scope; needs its own follow-up). One canonical copy,
   generated/symlinked to the other. Expected savings: ~4k tokens for
   agents that resolve both paths; ~16 KB off every fresh `init --full`
   clone burden. Risk: LOW.

### Structural (follow-up items with specs)

4. **C2 — `show <id>` with `--body` / `--meta` / `--tail-comments N`**
   (touches: new CLI command + MCP tool). Expected savings: bounded reads —
   an agent needing status+latest comment reads ~0.5 KB instead of an
   unbounded file (2.6 KB at 10 comments and growing). Risk: MEDIUM — new
   surface must stay in CLI/MCP parity; recommend also adding `arggon_show`
   to the MCP server.
5. **C4b — generated AGENTS.md context budget** (touches: templates/,
   docs generation). Target ≤2 KB with pointers into docs/ instead of
   inline rules; enforce with a check in `validate`. Expected savings:
   ~400+ tokens per session for every adopter. Risk: MEDIUM — copy change
   with adoption/behavior implications.
6. **C6 — comment tailing in `show`** rather than storage truncation:
   disk stays verbatim/auditable; only the read path bounds cost. Risk: LOW
   once C2 exists. Storage-side truncation is rejected (loses audit trail).
7. **C5 — MCP description trimming**: defer. 4.7 KB once per session is
   not a dominant cost; revisit after C1–C4 with a fresh budget measurement.

## Decision

ADR 0006 — `docs/adr/0006-token-context-efficiency.md` (status: Proposed in
this PR; Accepted on merge). Chosen direction: compact envelopes by default
(C1), `next`-first agent guidance (C3), `show <id>` progressive-disclosure
read path with comment tailing (C2+C6), and a generated-docs context budget
(C4). MCP trimming deferred (C5). Implementation lands via follow-up items,
not in this research item.
