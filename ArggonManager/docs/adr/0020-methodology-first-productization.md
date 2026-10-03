# 0020 Methodology-first productization with per-agent native adapters

- Status: Accepted
- Date: 2026-10-02
- Deciders: Gonzalo Arganaraz
- Input: [exploration-methodology-productization-018](../explorations/exploration-methodology-productization-018.md) (2026-10-02)
- Amendment (2026-10-02): this record's Claude Code **inventory** is corrected
  against shipped code — it understated the seam. An `arggon init` tree already
  hands a Claude Code client two destinations: the `CLAUDE.md` → `@AGENTS.md`
  pointer **and** the generated `.mcp.json` registering `arggon mcp`. That client
  therefore runs the same **fifteen-tool**, same-envelope MCP surface every other
  seam gets, through the same kernel. What is genuinely missing is narrower and
  client-side: no `.claude/` hook or permission configuration (no `PreToolUse`
  gate, no per-agent permission DSL) and no session context hook. The two dated
  amendments below mark the corrected points; the text they amend is left as
  written, so the decision still reads as it was taken. **Status unchanged**
  (still Accepted) — no decision here moves, the one-logic-path invariant is
  untouched, and the follow-on Claude Code adapter keeps the same bar
  ([spec-methodology-adapters-017 §S6](../specs/spec-methodology-adapters-017.md)).

## Context

ArggonManager's methodology (find → claim → work → review → merge → done,
spec/plan/ADR/exploration pipeline, review bar, docs-that-travel-with-code)
exists implicitly across `docs/agents.md`, `docs/engineering.md`,
`docs/convention.md` and the `arggon-cli` skill. Per ADR 0011 it is "the
contract", yet it is not versioned or presented as the product, and its
enforcement is uneven across agents: OpenCode V2 and ZCode have native seams
(ADR 0010/0011, ADR 0014), Claude Code has only a `CLAUDE.md` pointer. The
adapters that do exist underuse their agents' distinctive capabilities (ZCode
Goal Mode and automations are unexploited; OpenCode session hooks and TUI
panels are only partially used; Claude Code's plugin/hook/marketplace model is
unused).

The frontier interview settled three maintainer constraints: keep everything
in this repo (no fork), target OpenCode V2 + ZCode first, and validate via
exploration + ADR + spec + plan with tasks filed.

> Amendment (2026-10-02): the clause "Claude Code has only a `CLAUDE.md`
> pointer" describes the adapter-bundle work this record planned; it
> understated what an `arggon init` tree already ships. `.mcp.json` is an
> `arggon init` destination of the **`claude` seam** — `DOC_PATH_MAP["mcp-json"]`
> in `cli/src/docs.ts` (from `templates/docs/mcp-json`), with
> `cli/src/init.test.ts` asserting init creates it (`TIER1_DOCS`) — and the file
> registers `arggon mcp` as `{"command": "arggon", "args": ["mcp"]}`.
> `ArggonManager/docs/agents.md` §MCP server calls the generated `.mcp.json` "as
> part of the `claude` adapter seam", and §OpenCode V2 says the same file "still
> serves other clients (e.g. Claude Code)". So a Claude Code client in a standard
> init'd tree runs the **fifteen** tools `cli/src/mcp-server.ts` registers
> (`arggon_list` … `arggon_cleanup`) against the shared kernel
> (`@arggondev/lib`), returning the documented `--json` envelopes
> ([`ArggonManager/docs/json-output.md`](../json-output.md)). The pointer is one
> of two claude-seam destinations, not the whole of it.

## Decision

Adopt **C1** from the exploration:

1. **Promote the methodology carriers to the product surface.** Declare
   `ArggonManager/docs/agents.md`, `docs/engineering.md`, `docs/convention.md`
   and the bundled `arggon-cli` skill as _the ArggonManager methodology_ —
   scope (general projects, not only software), invariants (humans and agents
   follow the same rules; state in git; discipline enforceable; docs travel
   with code; never-steal/never-reopen), versioned with the package.
2. **Per-agent adapters** built on the same kernel: OpenCode V2 (plugin
   transforms, session hooks, TUI panels, permissions, worktree domain),
   ZCode (plugin marketplace, hooks, **Goal Mode**, **automations**), Claude
   Code (plugin bundle + marketplace — follow-on story).
3. **A capability matrix**, machine-readable and report-only via `arggon
doctor`: methodology invariant × agent → native mechanism or explicit gap.
4. `arggon init` gains adapter selection (e.g. `--agents opencode,zcode`),
   defaulting to every detected agent.

Rejected: **C2** (standalone methodology package — premature distribution
surface), **C3** (status quo — leaves the methodology invisible and the
Claude Code gap perpetual).

## Consequences

- Methodology edits become product decisions with the ADR 0016 impact
  classification attached; behavioral edits must reference the adopter
  upgrade channel.
- Every adapter's enforcement must delegate to the kernel — no adapter
  forks a rule (one logic path invariant from ADR 0010/0011/0014 stands).
- ZCode Goal Mode/automations and OpenCode hooks/TUI become product
  commitments: each needs a smoke story before merge.
- Claude Code adapter is a follow-on story with the same bar; today it
  remains docs + `CLAUDE.md`.

  > Amendment (2026-10-02): "today it remains docs + `CLAUDE.md`" is right about
  > the **bundle** and wrong about the **surface**. Shipped today: the
  > `CLAUDE.md` → `@AGENTS.md` shim (`templates/docs/CLAUDE.md`) plus the
  > generated `.mcp.json` registration of `arggon mcp`. The claude seam owns
  > exactly those two destinations — the `claude` entry of `AGENT_TEMPLATES` in
  > `cli/src/adapters.ts` matches `docs/CLAUDE.md` or `docs/mcp-json` and nothing
  > else, and `README.md` documents the same split — so a Claude Code client
  > reaches the shared kernel's refusals (never-steal, never-reopen), not just its
  > docs. Genuinely missing is the client-side layer, and that is what the
  > follow-on story owes:
  >
  > - **No client-side gate.** The seam ships no `.claude/` hook or permission
  >   configuration, so there is no `PreToolUse` gate and no per-agent permission
  >   DSL. OpenCode has deny rules in `templates/docs/opencode.jsonc` and ZCode
  >   ships the gate (`templates/docs/zcode/arggon/hooks/hooks.json` +
  >   `gate.mjs`); Claude Code has neither. On this client the kernel, the
  >   pre-commit gate (`ArggonManager/docs/agents.md` §Pre-commit gate:
  >   `npm run arggon -- validate`) and the generated CI recipe
  >   (`templates/docs/github/workflows/arggon.yml`: `init` + `validate`) are the
  >   **whole** enforcement path, so a claim refusal reached through
  >   `arggon mcp` is the only enforcement there is — a reader must not assume a
  >   backstop the tree does not ship.
  > - **No session context hook.** The OpenCode plugin injects the active work
  >   item through `ctx.session.hook("context")` (the bounded item block in
  >   `opencode/plugins/arggon/index.ts`); the claude seam has no equivalent, so
  >   the agent must fetch the item itself (`arggon show <id>`).
  >
  > The bundle that closes both — spec
  > [§S6](../specs/spec-methodology-adapters-017.md), under `adapters/claude/` —
  > stays a follow-on story with the same bar. The commitment is unchanged; only
  > the inventory was wrong.

- Non-software applicability is a scope statement, not a new schema:
  branch/PR model stays, verified sane for docs/research/ops repos.

## Alternatives considered

See the exploration: C2 (extract `@arggondev/methodology`), C3 (status quo).
Also considered: making MCP the only cross-agent surface (rejected — MCP is
parity floor, not the native-exploit layer).
