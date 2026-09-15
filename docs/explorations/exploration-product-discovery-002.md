---
exploration_id: product-discovery-002
title: "Product discovery: ecosystem survey and ranked feature candidates"
status: open
created: 2026-09-15
---

# Exploration: product-discovery (product-discovery-002)

Research item (task-product-discovery-research): an online product-discovery
pass over the agent-native tooling ecosystem, ending in ranked, evidence-backed
improvement/feature candidates for ArggonManager. All sources accessed
**2026-09-15** unless noted. No product code changes in this item.

## Criteria

What "better" means for ArggonManager, weighted:

1. **Token/context efficiency** (ADR 0006) — every byte an agent reads or
   writes per work-cycle is a cost; bounded reads, compact envelopes.
2. **Cheap infra / files-in-git** (ADR 0005, README principles) — no server,
   no SaaS dependency, repo is the source of truth, agent-executable from
   files alone.
3. **Architecture-first** — spec → plan → implement discipline; exploration
   and ADRs precede code.
4. **Same rules for humans and agents** — no agent-only or human-only paths.
5. **Scope discipline** — features that require hosted state, SaaS accounts,
   or cross-repo coupling are rejected by default.

## Candidates (landscape)

| Tool / practice | Quadrant | One-line differentiator | Dated source |
| --- | --- | --- | --- |
| Beads (`bd`) | Agent-native tracker | Git-backed SQL/Dolt issue tracker pitched as agent *memory* with an enforced dependency graph ("ready work" computation) | steve-yegge.medium.com (accessed 2026-09-15); beads.gascity.com |
| Backlog.md | Agent-native tracker | In-repo Markdown tasks + bundled Claude Code agent that writes implementation plans and notes back into tasks | gorannikolovski.com/blog (2026-09-15) |
| claude-task-master | Agent-native tracker | PRD-driven: generates a dependency-ordered task list from a product-requirements doc | github.com/eyaltoledano/claude-task-master (2026-09-15) |
| Linear × Copilot cloud agent | Agent-native tracker | Assign a hosted issue to a coding agent; agent opens a draft PR; issue→PR association is first-class | github.blog changelog 2026-07-23 |
| GitHub Issues + coding agents | Agent-native tracker | Agents assigned from GitHub Issues, Azure Boards, Jira; planning context travels with the agent | github.com/features/copilot/agents (2026-09-15) |
| Vibe Kanban | Worktree orchestration | Kanban orchestrator: parallelize agents across git worktrees, review agent diffs before merge | vibekanban.com (via search, 2026-09-15) |
| Conductor | Worktree orchestration | macOS UI: one worktree+branch per Claude Code/Codex agent, dashboard + diff-first review | madewithlove.com/blog (2026-09-15) |
| Claude Squad / CodeAgentSwarm | Worktree orchestration | Terminal-native worktree orchestration; agents read/update the board via MCP | codeagentswarm.com (2026-09-15) |
| Terragon | Worktree orchestration | Cloud execution: agents run remotely instead of on local worktrees | nimbalyst.com/blog (2026-09-15) |
| GitHub Spec Kit | Spec-driven kit | Phase-gated SDD: constitution → specify → **clarify** → plan → tasks → implement → analyze (cross-artifact consistency) | github.com/github/spec-kit (2026-09-15) |
| OpenSpec | Spec-driven kit | Lightweight **change proposals**: proposal + spec deltas + tasks per change, archived back into source-of-truth specs | github.com/Fission-AI/openspec (2026-09-15) |
| Kiro | Spec-driven kit | Purpose-built IDE where specs are referenceable documents steering the agent (vs in-repo markdown) | dev.to/filiksyos (2026-09-15) |
| llms.txt | Context engineering | Site-level agent-readable doc index; still a community convention, contested value for LLM providers | llmstxt.org; buildwithfern.com May 2026 guide (accessed 2026-09-15) |
| AGENTS.md convention | Context engineering | De facto repo-level agent-instructions standard; complementary to llms.txt | quattr.com comparison (2026-09-15) |
| MCP progress notifications | Context engineering | Long-running MCP tools emit async progress events; real-world adoption issues documented | ACM dl.acm.org/doi/10.1145/3786161.3788462 (2026-09-15) |
| MCP context-overload design | Context engineering | Server design guidance: minimize context surfaced per tool call; reranking/filtering clients | itential.com; contextual.ai/blog (2026-09-15) |
| Agent memory / compaction | Context engineering | Structured persistent memory replacing ad-hoc PLAN.md files; agents resume exactly where they left off | beads docs + ANU comp4020 task-tracking notes (2026-09-15) |

## Findings

Facts learned, each with a dated source (all accessed 2026-09-15):

- **The ecosystem converged on files-in-git** for agent task tracking (Beads,
  Backlog.md, HN debate on Markdown trackers) — ArggonManager's core bet is
  now mainstream, not contrarian. (news.ycombinator.com/item?id=46487580)
- **Dependency graphs are table stakes.** Beads' core pitch is an enforced
  "depends on" tree so agents always know what is *ready*; ArggonManager has
  `depends_on` + `next --ready` but dependencies are advisory and the
  `next` suggestion is lexicographic, not graph-ranked. (steve-yegge.medium.com)
- **The "tracker as agent memory" framing** (ephemeral working memory vs the
  human-visible tracker) is a distinct mental model from ArggonManager's
  "one tracker for both". (comp.anu.edu.au task-tracking)
- **Issue→agent→PR association is a product surface** (Linear+Copilot GA
  2026-07-23): assign → analyze → draft PR, with status flowing back.
  ArggonManager has `import-issues` + `Closes #N` but no *live* issue
  assignment or status round-trip. (github.blog 2026-07-23)
- **Spec-kit's phase gates include a machine-driven clarify step and
  cross-artifact consistency analysis** (`/clarify`, `/analyze`);
  ArggonManager's `spec validate` checks structure but has no
  ambiguity-detection or spec↔tasks consistency pass.
  (github.com/github/spec-kit quickstart)
- **OpenSpec's change-proposal pattern** (per-change folder: proposal, spec
  deltas, tasks, then archive) maps closely onto ArggonManager's
  story→task tree plus `spec new`, but OpenSpec versions *spec deltas* per
  change — ArggonManager specs are single-file, no delta/supersede workflow
  beyond a `superseded` status. (github.com/Fission-AI/openspec)
- **Orchestration tools differentiate on review UX** (diff-first review,
  dashboards) and **cloud execution** (Terragon); ArggonManager covers the
  tracker + worktree plumbing (`start --worktree`, `cleanup`) but has no
  agent execution or diff-review surface — by design (no infra), the gap is
  review ergonomics on the board. (madewithlove.com; nimbalyst.com)
- **Board tools increasingly expose MCP** so agents read/update the board
  (CodeAgentSwarm, Agent Kanban); ArggonManager's MCP has 4 tools
  (list/create/update/comment) — no `next`, `show`, `report`, `validate`
  parity. (codeagentswarm.com; agent-kanban.dev)
- **llms.txt remains an unratified, contested convention** for docs sites;
  AGENTS.md won for repos. ArggonManager already generates AGENTS.md —
  an `llms.txt` for the generated docs set is low-value.
  (llmstxt.org; cdp.com; medium.com/@kaispriestersbach)
- **MCP progress notifications** matter for long-running tools and are
  error-prone in practice; ArggonManager's MCP tools are all fast/synchronous,
  so this is a non-issue today. (dl.acm.org/doi/10.1145/3786161.3788462)
- **What ArggonManager does that most of the field does not:** hierarchical
  initiative→epic→story→task tree, cascade container completion, adopt
  flow with provenance-checked doc regeneration, cheap-path-to-prod deploy
  guidance, playbooks with freshness tracking, generated-docs context
  budget (ADR 0006). None of the surveyed trackers/orchestrators has these.
- **What ArggonManager lacks that the field has:** PRD→task-list generation
  (claude-task-master), spec clarify/analyze phases (Spec Kit), spec deltas
  per change (OpenSpec), review-diff board surface (Vibe Kanban et al.),
  dependency-weighted "ready work" ranking (Beads), live GitHub issue
  round-trip (Linear+Copilot), full MCP CLI parity.

## Ranked candidate improvements/features

Rank = (evidence strength) × (principle alignment) ÷ (effort). Surfaces: docs / CLI / MCP / board.

| # | Candidate | Problem solved | Evidence (dated) | Effort | Principle / ADR | Surface |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **MCP tool parity: `next`, `show`, `report`, `validate`** | MCP-only agents fall back to raw file reads (unbounded context) or cannot get a suggestion at all — the ADR-0006 win of `next`-first guidance stops at the CLI | Board/orchestrator tools ship MCP board access as the agent surface (codeagentswarm.com, 2026-09-15); ADR 0006 measured MCP at 4 tools | M | token-context (ADR 0006) | MCP (+CLI parity tests) |
| 2 | **Dependency-weighted `next` ranking** | Lexicographic-first `next` ignores graph shape; agents pick arbitrary ready work instead of unblocking the most downstream items | Beads' core differentiator is enforced ready-work computation (steve-yegge.medium.com, 2026-09-15) | S | architecture-first; token-context (one right answer) | CLI |
| 3 | **Spec clarify / consistency check (`spec analyze`)** | Specs pass structural validation yet stay ambiguous; agents implement guesses. A checklist-driven ambiguity scan + spec↔tasks cross-check closes the loop Spec Kit proven valuable | Spec Kit `/clarify` + `/analyze` (github.com/github/spec-kit, 2026-09-15) | M | architecture-first | CLI |
| 4 | **Spec deltas / supersede workflow** | Changing a spec silently rewrites the file; no record of what changed per work item. OpenSpec's per-change proposal+delta+archive keeps source-of-truth specs versioned by change | github.com/Fission-AI/openspec (2026-09-15) | M | architecture-first; repo-is-truth | CLI (docs/specs layout) |
| 5 | **PRD/epic → task-tree generation** | Greenfield epics need manual task decomposition; a PRD file → draft dependency-ordered task tree (status `todo`, human/agent reviews then claims) removes a repetitive planning step | claude-task-master's core workflow (github.com/eyaltoledano/claude-task-master, 2026-09-15) | M | architecture-first; same-rules (draft is reviewable in git) | CLI |
| 6 | **Board review surface: per-item PR status + diff link** | Cards show PR badge only with `--github`; a standing `--serve` board with PR state, checks, and diff links makes the board the review cockpit orchestration tools compete on | Vibe Kanban / Conductor diff-first review (vibekanban.com, madewithlove.com, 2026-09-15) | M | cheap-infra (reuse gh read path) | board |
| 7 | **GitHub issue round-trip (`sync` deepening)** | `import-issues` is one-shot; items can't push status back to a linked issue on `done` (`gh issue close` via the recorded `issue` field), so dual-tracker teams drift | Linear×Copilot issue→PR→status flow (github.blog, 2026-07-23) | S | same-rules; repo-is-truth (issue id already in frontmatter) | CLI |
| 8 | **`arggon handoff` structured resume note** | Session end loses working state; a command that appends a structured handoff comment (current branch, next step, open questions) makes Beads-style "resume exactly where you left off" a tracker feature | Beads memory framing (beads.gascity.com, 2026-09-15); ArggonManager `comment` is freeform only | S | token-context (bounded, structured vs prose) | CLI + MCP |
| 9 | **Board/TUI dependency rendering + `--group-by story`** | Board cards show deps as text lines but no visual blocking (greyed-out blocked cards); TUI has no dependency awareness at all | Agent Kanban dependency visuals (agent-kanban.dev, 2026-09-15) | S | cheap-infra | board / TUI |
| 10 | **`arggon doctor --budget` re-measure + ADR 0006 verify** | ADR 0006 promised re-measurement after directions 1–4 land; without a repeatable measurement command the budget claim can drift | ADR 0006 consequences (2026-09-14); context-overload design guidance (itential.com, 2026-09-15) | S | token-context (ADR 0006) | CLI |
| 11 | **Generated `llms.txt`-style docs index** | Adopter repos have 10+ generated docs; a one-page index (path × audience × size) helps both agents and humans route reads. Low priority: AGENTS.md already serves the repo-level role and llms.txt itself is contested | llms.txt status (llmstxt.org + cdp.com, 2026-09-15) | S | token-context | docs/CLI (init output) |
| 12 | **Cloud/remote execution hook** | Terragon-style remote agents need a way to record "this item runs elsewhere"; a `worktree_path`-like remote URL field + cleanup awareness | Terragon cloud execution (nimbalyst.com, 2026-09-15) | M | cheap-infra (still files-in-git) | CLI |

## Evaluated and rejected

Scope discipline is part of this deliverable:

- **Hosted tracker/SaaS board (multi-tenant, accounts, server state)** —
  rejected: violates README principle "repo is source of truth" and the
  cheap-infra principle (ADR 0005); the whole field is moving *toward*
  files-in-git, away from this.
- **Agent execution engine (spawn/manage coding agents, like Conductor or
  Vibe Kanban's runners)** — rejected: out of scope for a tracker; heavy,
  platform-specific, and duplicated by Claude Squad/Vibe Kanban.
  ArggonManager's lane is the shared tracker those tools can read.
- **Cloud remote execution service (Terragon-style)** — rejected as a
  product; candidate 12 covers only the *tracker-side record* of remote work.
- **Kiro-style purpose-built IDE / GUI app** — rejected: contradicts
  cheap-infra and the CLI-first architecture; the board HTML already covers
  visual needs at zero infra.
- **Cross-repo monorepo coupling (one tracker spanning several repos)** —
  rejected: breaks the walk-up `tasks/` model, git-native claims, and
  cascade semantics; a "linked repo" field could be explored later but
  shared-state across trees violates tracker-in-tree.
- **`llms.txt` as a primary agent surface** — rejected (demoted to #11
  docs-index only): unratified and contested (major providers largely
  ignore it — medium.com/@kaispriestersbach, 2026-09-15); AGENTS.md won the
  repo-level role ArggonManager already generates.
- **MCP progress notifications for long-running tools** — rejected for now:
  all arggon MCP tools are fast/synchronous; documented adoption issues
  (ACM, 2026-09-15) suggest waiting until a genuinely long-running tool
  exists.
- **SQL/database-backed tracker (Beads-style Dolt store)** — rejected:
  markdown files *are* the audit trail and the differentiator; a binary DB
  breaks diffability, review, and "files over forms".

## Next-cycle candidates (file first, in order)

1. **MCP tool parity (#1)** — completes ADR 0006's token-efficiency program
   for the agent-native surface; MCP agents currently get the worst read
   path. Medium effort, high leverage, no convention change.
2. **Dependency-weighted `next` (#2)** — small, pure read-path win that
   matches the field's proven "ready work" expectation; immediate agent UX
   improvement.
3. **Spec clarify/analyze (#3)** — the strongest architecture-first gap vs
   Spec Kit; positions ArggonManager's spec pipeline as more than a
   template validator.
4. **GitHub issue round-trip (#7)** — small effort on existing frontmatter
   (`issue` field), removes the most concrete integration drift teams hit.
5. **`arggon handoff` (#8)** — small, novel, and on-message: turns the
   ecosystem's "agent memory" pitch into a bounded, tracker-native feature.

## Recommendation

Land the token-context completions first (1, 2, 10) — they are cheap and
finish an accepted ADR's program — then deepen the architecture-first
pipeline (3, 4, 5), then board/review ergonomics (6, 9). Keep the rejected
list above as the standing scope boundary for future discovery passes.

## Decision

ADR placeholder: docs/adr/0000-<slug>.md (this is a research item — the
coordinator files follow-up items after review; no ADR is required for the
research itself, but any candidate that becomes an accepted direction
deserves one).
