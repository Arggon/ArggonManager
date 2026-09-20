---
exploration_id: exploration-opencode2-native-010
title: OpenCode2-native ArggonManager — capability audit and native redesign
status: open
created: 2026-09-19
---

# Exploration: OpenCode2-native ArggonManager — capability audit and native redesign (exploration-opencode2-native-010)

Spike record for epic `opencode2-native`: inventory every OpenCode V2 surface,
map each ArggonManager capability to native mechanisms, and recommend the
architecture. The decision lands in ADR 0011 (link under Decision).

**Directive (product owner, 2026-09-19):** the `opencode2` branch exists to
build something exclusive to OpenCode V2, as native as possible — rewriting
everything if needed, discarding the CLI and/or the MCP server. The product
owner delegated **D1** (source of truth) and **D2** (methodology contract) to
this audit.

**Sources:** `https://opencode.ai/v2/llms.txt` and the linked V2 docs (accessed
2026-09-19), local runtime `opencode v2.0.10` (2026-09-19; the playbook still
pins 2.0.8 — drift recorded in F1.16), [ADR 0010](../adr/0010-opencode2-native-architecture.md),
[exploration-opencode-v2-native-009](exploration-opencode-v2-native-009.md),
`docs/playbooks/opencode.md`, and the current code (`cli/src/`,
`opencode/plugins/arggon/`).

## Candidates

- **A — Native plugin monolith.** Drop the CLI and MCP from the product; the
  kernel lives in-process in the plugin; tools, commands, permissions, hooks,
  worktrees and the board are all native. Git-native `tasks/` remains the data.
- **B — Native-first hybrid.** The daily surface is native (in-process tools,
  commands, permissions, worktree domain, TUI); a thin headless entry point
  survives for bootstrap (`init`) and CI/`--json`; MCP becomes optional.
- **C — Runtime-state tracker.** `tasks/` is replaced by OpenCode runtime state
  (`ctx.storage`/DB); no git-native data.
- **D — Status quo (ADR 0010).** Portable CLI+MCP core, thin vendored plugin;
  native tools explicitly deferred.

## Criteria

1. **Nativity** — how much of the workflow runs through first-class V2 surfaces
   (tools, hooks, permissions, sessions, worktrees, TUI) without subprocess
   bridges.
2. **Data integrity** — diffs/review of work items in git, migration of
   existing trees, survivability of runtime churn.
3. **Robustness** — failure isolation (a surface failure must not break a
   session), API churn at 2.0.x, least privilege.
4. **Testability** — headless evidence (`opencode run`) and CI gates.
5. **Bootstrap and CI** — how a new repo gets the system (`init`), how CI
   claims/validates without a model.
6. **Context budget** — ADR 0006 surfaces must not grow.

## Findings

### F1 — Surface inventory (OpenCode V2, accessed 2026-09-19)

1. **Config and instructions.** `opencode.json(c)` carries `mcp.servers`,
   `permissions`, `agents`, `commands`, `skills`, `plugins`, `snapshots`,
   compaction retention; `AGENTS.md` is the instruction mechanism
   (source: <https://opencode.ai/v2/docs/config/>, 2026-09-19).
2. **Agents.** Markdown/JSONC with `mode` (`primary|subagent|all`), ordered
   `permissions` (last match wins), `model` (+`#variant`), `system`, `steps`,
   `hidden`, `disabled`, `color`; `request` overlays are accepted but **inert**
   in V2. Subagents run in child sessions with fresh context (source:
   <https://opencode.ai/v2/docs/agents/>, 2026-09-19); nesting depth defaults
   to one (source: <https://opencode.ai/v2/docs/tools/>, 2026-09-19).
3. **Commands.** `.md`/JSON, `$ARGUMENTS`/`$1..$n`, `agent`, `model`,
   `subagent: true` (background child), shell blocks `` !`cmd` `` run outside
   the tool-permission flow, project sources replace global, hot reload
   (source: <https://opencode.ai/v2/docs/commands/>, 2026-09-19).
4. **Skills.** `SKILL.md` (or flat `.md`) discovered from `.opencode/skills`,
   `.agents/skills`, `~/.config/opencode/skills`, plus HTTP catalogs;
   `metadata.opencode/autoinvoke` and `slash` control advertisement; loading is
   permission-gated by skill ID (source: <https://opencode.ai/v2/docs/skills/>, 2026-09-19).
5. **Tools.** Built-ins: `read`, `glob`, `grep`, `edit`, `write`, `patch`,
   `shell`, `webfetch`, `websearch`, `question`, `skill`, `subagent`,
   `execute` (Code Mode), `browser` (desktop/Code Mode namespace); MCP tools
   are `<server>_<tool>`
   (source: <https://opencode.ai/v2/docs/tools/>, 2026-09-19).
6. **Permissions.** Ordered `{action, resource, effect}` rules, last match wins,
   `allow|ask|deny`, whole-value wildcards, defaults + per-agent policies,
   durable project-scoped saved approvals; actions include `read`, `edit`,
   `shell`, `subagent`, `skill`, `question`, `webfetch`, `websearch`,
   `external_directory`, `execute`, and MCP `<server>_<tool>`
   (source: <https://opencode.ai/v2/docs/permissions/>, 2026-09-19).
7. **Snapshots.** Best-effort per-step file capture inside a git worktree,
   `/undo`/`/redo`, separate internal object DB, explicitly _not_ a transaction
   or backup (source: <https://opencode.ai/v2/docs/snapshots/>, 2026-09-19).
8. **Plugin API (server).** Transforms: `provider`, `model`, `agent`,
   `command`, `mcp`, `integration`, `reference`, `skill`, `tool`, `websearch`,
   `worktree`, `vcs`. Hooks: `prompt`, `context`, `compaction`, `generate`,
   `title`, `model.request`, `http.request/response`, experimental WS,
   `retry`. Plus `ctx.storage` (durable), `ctx.event.subscribe`,
   `ctx.permission.rules`, `ctx.session.*` (create/get/context/switch/prompt/
   generate/command/synthetic/interrupt/rename/wait), `ctx.generate.text`,
   `ctx.plugin.list`,
   `client`/SDK/RPC/Effect. `ctx.tool.transform` supports namespaces and
   `options.codemode: true`; `ctx.worktree` exposes
   `create/list/refresh/remove` and pluggable strategies; `ctx.vcs` exposes
   `get/branches/status/diff` (source: <https://opencode.ai/v2/docs/build/plugins/>, 2026-09-19).
9. **CLI/TUI plugin API.** Commands/keymaps (global or scoped), slash commands,
   routes, slots incl. `session.panel`/`sidebar.*`, dialogs, toasts,
   notifications/sounds, markdown renderers, durable+memory storage, events,
   theme tokens, `session.*` utilities
   (sources: <https://opencode.ai/v2/docs/build/plugins/cli/>, <https://opencode.ai/v2/docs/cli/plugins/>, 2026-09-19).
10. **MCP.** `mcp.servers` config with local/remote types; plugins can
    register/replace via `ctx.mcp.transform`; tools are permission-gated as
    `<server>_<tool>` (source: <https://opencode.ai/v2/docs/mcp-servers/>, 2026-09-19).
11. **Sessions and orchestration.** Child sessions for subagents/background
    commands, `session.prompt/command/wait/interrupt`, per-session permission
    rules, agent/model switching — enough to drive coordinator/worker/reviewer
    natively (source: build/plugins + commands docs, 2026-09-19).
12. **Code Mode.** `execute` runs JS that composes catalog tools; `execute`
    permission gates availability, nested tools keep their own rules; tools
    registered with `codemode: true` join the catalog (sources: tools + build
    docs, 2026-09-19).
13. **Sharing.** Session sharing is documented as **not supported yet** in V2;
    ADR 0010 listed the sharing surface as not relied on and this audit keeps
    that stance: no tracker impact
    (source: <https://opencode.ai/v2/docs/sharing/>, 2026-09-19).
14. **Compaction and context.** `compaction` retention config plus the
    `compaction` hook for checkpoint summaries; ADR 0006 budgets must be
    re-measured for native tool schemas (sources:
    <https://opencode.ai/v2/docs/config/>,
    <https://opencode.ai/v2/docs/build/plugins/>, 2026-09-19).
15. **API/client/SDK.** The server exposes an HTTP API with an OpenAPI
    document (the published spec is <https://opencode.ai/v2/openapi.json>) and
    generated TypeScript clients; an SDK supports embedding OpenCode in an
    application. TUI plugins can call the connected server (including remote)
    through `context.client` (sources: <https://opencode.ai/v2/docs/api/>,
    <https://opencode.ai/v2/docs/build/client/>,
    <https://opencode.ai/v2/docs/build/sdk/>,
    <https://opencode.ai/v2/docs/build/plugins/cli/>, 2026-09-19).
16. **Runtime drift.** Local runtime is **v2.0.10**; `docs/playbooks/opencode.md`
    still records 2.0.8 and its A/B plugin-import probe. The playbook pin
    refresh + A/B re-probe is filed as `task-playbook-opencode-2-0-10`.

### F2 — ArggonManager capability map

Current surface from ADR 0010: kernel (`cli/src/rules.ts` + `run*`), CLI (human + `--json`), stdio MCP (9 tools), plugin (ambient), agents,
commands, skill, config seam. Native candidates per capability:

| Capability                                   | Current (v0)                          | Native candidate(s)                                                            | Notes / trade-offs                                                                               |
| -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Item CRUD/`show`/`list`                      | CLI + MCP                             | `ctx.tool.transform` namespaced `arggon` tools calling the kernel in-process   | Removes subprocess bridge; enables `codemode: true` catalog; needs kernel published as a library |
| `validate`                                   | CLI                                   | Tool + post-commit hook + CI                                                   | Keep CI gate; hook stays advisory                                                                |
| `next` (priority ranking)                    | CLI + MCP                             | Tool                                                                           | Pure function; ideal in-process                                                                  |
| `report`/`trend`                             | CLI                                   | Tool + TUI route/panel                                                         | Output surfaces native (panel/sidebar)                                                           |
| Board                                        | `arggon board` static HTML            | CLI plugin route (`ui.router.register`) + slots/panels; web app via API/client | Native TUI board; web console as an option                                                       |
| Claim (+ never steal)                        | CLI kernel rule                       | Tool/kernel validation + `ctx.permission.rules`                                | Permissions complement, never replace, kernel invariants                                         |
| `start` (claim+branch+worktree+PR)           | CLI                                   | `ctx.worktree.create/list/remove` (+ strategy) + tools + `session.*`           | Worktree domain can own naming/lifecycle; PR step stays a tool (`gh`)                            |
| Review gate                                  | CLI + reviewer agent                  | Reviewer agent permissions (edit deny) + subagent + CI                         | Already native; formalize as contract                                                            |
| `done`/cascade                               | CLI kernel                            | Tool                                                                           | Cascade stays kernel logic                                                                       |
| Methodology docs (spec/ADR/plan/exploration) | CLI + `/arggon-*` commands            | Command transform + skill + templates                                          | Markdown artifacts unchanged; ADR docs are authored, no CLI verb                                 |
| `doctor`                                     | CLI                                   | Tool + startup diagnostics (plugin setup)                                      | Can report per-session config health                                                             |
| `init`/scaffold                              | CLI                                   | **No native path**: a plugin exists only after bootstrap                       | Requires a headless bootstrap artifact (npx package) — see D3                                    |
| Orchestration (coordinator/worker/reviewer)  | agents + subagents                    | agents + subagents + sessions + background commands + permission rules         | Mostly already native                                                                            |
| Context injection                            | plugin `session.hook("context")`      | Same (already native)                                                          | Keep ≤1 KiB bound (ADR 0006)                                                                     |
| Hygiene after commit                         | plugin warning                        | Events/hooks + tool                                                            | Keep non-blocking                                                                                |
| Session↔item correlation                     | plugin storage + VCS + observed calls | Same (already native)                                                          | Storage is cache, never source of truth                                                          |
| Tracker data                                 | `tasks/` Markdown (canonical)         | D1: keep git files, or `ctx.storage` (candidate C)                             | See D1                                                                                           |
| `priority` (+ `migrate`)                     | CLI                                   | Tool (ranking surface) + command                                               | `next` already ranks; expose read/write                                                          |
| `comment`/`handoff`                          | CLI + MCP (2 of 9 tools)              | Tool + session-end flow                                                        | Append-only history; allowed on done items                                                       |
| `sync`/`import-issues` (GitHub)              | CLI                                   | Tool + `gh`/`ctx.integration`                                                  | Network-dependent; reconciliation stays explicit                                                 |
| `adopt`                                      | CLI                                   | Command + skill + templates                                                    | Guided documentation adaptation                                                                  |
| `cleanup`                                    | CLI                                   | Worktree domain `list/remove` + tool                                           | Tracker record clearing stays kernel                                                             |
| `branch`                                     | CLI                                   | `ctx.vcs` (branches) + tool                                                    | Git stays the substrate                                                                          |
| `instructions` (agent wiring)                | CLI                                   | Config seam + AGENTS.md router + skill                                         | No bespoke command needed                                                                        |
| Config seam (`opencode.jsonc`)               | generated MCP stanza                  | Generation stays; **content changes** (MCP demoted; plugin/compaction only)    | Seam shape is an ADR 0011 detail                                                                 |
| MCP surface (`arggon mcp`)                   | stdio server (9 tools)                | Optional adapter generated from the kernel; dropped from the default path      | See D3                                                                                           |

Capabilities that are **explicitly native already** (no change needed): agents,
commands, skill advertisement, context hook, session correlation. `hello`
(diagnostic banner) is dropped, and `mcp` is covered by the MCP row.

### F3 — Decision points

**D1 — Source of truth (recommend: keep git-native `tasks/`).**

- _Git-native (recommended)._ Diffs, review and blame of work items live in the
  same PRs as code; CI can claim/validate without a model; migrating existing
  trees is trivial; data survives runtime/API churn. Cost: the plugin must read
  the filesystem (cheap; already does).
- _Runtime state (`ctx.storage`)_ — reject as canonical: plugin-scoped JSON is
  not queryable/versioned, has no diff/review story, couples the tracker's
  lifetime to the editor, and breaks CI/headless consumers. It stays a cache
  (session correlation) only.
- _Hybrid projection_ — a native index over `tasks/` is fine as a cache
  (rebuildable), never canonical.

**D2 — Methodology contract (recommend: keep the contract, redesign the
mechanics).**

- Keep: the Agile tree (`initiative→epic→story→task/bug`), statuses and claim
  invariants, `one logic path`, the loop claim → worktree → PR → review → merge
  → done, and the methodology docs pipeline.
- Redesign natively: rule _enforcement_ gains a second native layer
  (`ctx.permission.rules` for hard denials + agent policies), worktree
  lifecycle moves to the worktree domain, workflow entry points become native
  tools/commands, and the board/status surfaces become TUI panels/routes.
- Rationale: the essence is the product (product owner kept "the essence and
  the working method" in ADR 0010's context); the redesign target is the
  runtime, not the method.

**D3 — Implementation-level decisions.**

- _Kernel in-process_: publish the kernel as a library consumed by the plugin
  (ADR 0010 deferred this for packaging cost; candidate B assumes it). One
  logic path is preserved by construction.
- _MCP_: drop from the default path; optionally keep as a generated adapter
  for non-OpenCode clients. The 9 tools keep parity tests only if the adapter
  remains.
- _CLI_: keep only as a **bootstrap/headless entry point** (`init`, CI
  `validate`/`--json`, `doctor`) or drop entirely once a bootstrap alternative
  exists (npx scaffolder/template). Daily UX: native.
- _Distribution_: publish one npm package (kernel library + plugin + thin
  bin). ADR 0010 deferred npm publishing; candidate B requires it.
- _Worktrees_: evaluate `ctx.worktree.transform` strategy vs tools that call
  git directly; strategies give inventory/ownership but are project-scoped and
  loaded from the canonical checkout.

### F3.1 — Revisiting ADR 0010's alternatives

| ADR 0010 stance                                                        | This audit                                                                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Native plugin tools **deferred** ("no proven gain"; MCP parity)        | **Adopted**: native-first is the new directive, and `ctx.tool.transform` now offers namespaces + `codemode`; MCP loses its default role       |
| In-process kernel **deferred** (packaging cost)                        | **Adopted**: publish the kernel as a library (candidate B assumes it) to remove the subprocess bridge while keeping one logic path            |
| npm plugin package **deferred**                                        | **Required**: distribution + bootstrap (single package: kernel + plugin + thin bin)                                                           |
| CLI rewritten as plugin-only **rejected** (portable core, cross-agent) | **Reconsidered** (candidate A as end-state); candidate B keeps a thin headless artifact for bootstrap/CI, not as daily UX                     |
| MCP-only **rejected** (no ambient behavior)                            | Still rejected; MCP demoted to optional adapter                                                                                               |
| SDK embedding / OpenCode as core dependency **rejected**               | Still rejected: even with an exclusive runtime, the git data contract and a headless bootstrap keep CI and migration independent of embedding |

### F4 — Risks

1. **API churn at 2.0.x.** Native tools/domains are newer than the CLI. Mitigate:
   pin 2.0.10 in the playbook, feature-detect, keep every path failure-isolated.
2. **Bootstrap paradox.** Without a bootstrap artifact there is no `init` to
   generate the seam. A packaged bin (or template repo) must survive even in
   candidate A.
3. **Failure isolation.** In-process kernel means a kernel bug can fail a tool
   call; the plugin must not break sessions (wrap, typed errors, no throw in
   hooks).
4. **Testing strategy.** Today's headless `opencode run` harness must grow
   cases for native tools/commands/permissions; CI stays authoritative for the
   tracker contract.
5. **Migration.** Existing adopters have CLI/MCP-era trees and vendored
   plugin copies; `init` provenance semantics must handle the transition.
6. **Context budget.** Native tools add schemas to every request; `codemode`
   namespaces and skill progressive disclosure are the budget levers (ADR 0006
   measurement must be re-run).
7. **Dependency-less plugin trees.** The guarded `@opencode/plugin` import
   gotcha (playbook) still applies if the plugin stays vendored; the
   kernel-as-library wave must decide vendoring vs published package without
   breaking dependency-less adopters.

## Recommendation

**Adopt candidate B (native-first hybrid), with D1 = git-native `tasks/` and
D2 = contract kept, mechanics native.**

- The native surface owns the daily workflow: in-process `arggon` tools
  (namespaced, `codemode`), native commands, permissions for hard gates,
  sessions/subagents for orchestration, the worktree domain for item
  worktrees, TUI panels/routes for board/status, and the existing context hook.
- One thin headless artifact survives: bootstrap (`init`) + CI/`--json` +
  `doctor`, because adopters must be able to create the seam and CI must be
  able to run without a model. MCP is dropped from the default path (optional
  adapter only if non-OpenCode clients stay a goal).
- Git-native `tasks/` stays canonical; runtime storage is cache.
- Candidate A remains the end-state option once bootstrap is solved natively
  and CI runs off a headless bin; candidate C is rejected on data-integrity
  grounds; candidate D is superseded.

### ADR 0011 outline

1. Decision: native-first surface, git-native data, one in-process kernel.
2. Supersedes ADR 0010 §2/§3 (thin surface; native tools deferred) and its
   packaging deferrals; keeps the portable _data_ contract.
3. Surface map: tools/commands/skills/agents/permissions/worktrees/TUI; MCP
   and CLI as optional adapters.
4. Distribution: single npm package (kernel + plugin + bootstrap bin).
5. Migration: `init`/provenance path from the ADR 0010 surface.
6. Risks and revisit triggers (API churn, bootstrap, context budget).
7. Waves to file: kernel-as-library; native tools + commands; permission
   gates; worktree domain; TUI board; CI/headless adapter; dogfood.

### Open tensions for ADR 0011

- **Bootstrap artifact form** (packaged bin vs template repo) and the explicit
  B→A criteria.
- **Kernel-as-library vs vendored dependency-less trees** (guarded-import
  gotcha; F4.7).
- **Config-seam content** after the MCP demote.
- **MCP adapter**: drop now vs keep as a conditional export; the directive is
  OpenCode-exclusive, so the default recommendation is drop.
- **ADR 0006 re-measurement** as the gate for the native-tools wave.
- **Playbook pin refresh** to 2.0.10 + A/B re-probe (filed as
  `task-playbook-opencode-2-0-10`).

### Follow-ups filed

- `task-native-adr-0011` — ADR 0011 decision from this exploration.
- `task-playbook-opencode-2-0-10` — refresh the playbook pin and re-probe.

## Decision

<!-- ADR reference placeholder: docs/adr/0011-<slug>.md once the ADR lands. -->
