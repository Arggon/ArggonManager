---
playbook_id: opencode
version: 2.0.10
researched: 2026-09-20
status: current
---

# OpenCode V2 playbook (opencode)

Technology playbook: the chosen version and the current best practices for
OpenCode **V2** in this repo.

**Research record (2026-09-20):** local `opencode v2.0.10` (original research
2026-09-17 on v2.0.7; the plugin-import A/B was re-probed on 2.0.8 and again on
2.0.10 — 2026-09-20). Sources are the **V2** docs only —
https://opencode.ai/v2/docs/ (**accessed 2026-09-20**) — plus the
[exploration-opencode-v2-native-009](../explorations/exploration-opencode-v2-native-009.md),
the [native-redesign audit](../explorations/exploration-opencode2-native-010.md)
and [ADR 0010](../adr/0010-opencode2-native-architecture.md). Do not consult V1
docs or the V1 schema for V2 work.

## Setup

- Install per https://opencode.ai/v2/docs/ (accessed 2026-09-20); verified local
  version: `opencode --version` → `v2.0.10` (2026-09-20; previous pins 2.0.7 →
  2.0.8).
- Running this branch beside `main`: give the oc2 build a named shim and a
  per-project PATH — see
  [Side-by-side installs](../opencode2.md#side-by-side-installs). Note the MCP
  stanza resolves bare `arggon` with the OpenCode server's PATH, not the
  project's.
- `arggon init` generates the tier-1 seam: `opencode.jsonc` **only when the repo
  has no OpenCode config of its own** (`opencode.json(c)` at the root or
  `.opencode/opencode.json(c)`), plus `.opencode/agents/arggon-{coordinator,worker,reviewer}.md`
  and `.opencode/commands/arggon-{next,start,done,handoff,review,status,spec,adr,explore,playbook}.md` —
  never overwriting modified files (contract:
  [spec-opencode-seam-010](../specs/spec-opencode-seam-010.md)).
- `arggon init` also bundles the optional plugin at
  `.opencode/plugins/arggon/index.ts` (auto-discovered, zero config). It is
  failure-isolated (every path logs once and no-ops, never breaking a
  session/CLI/MCP); `Plugin.define` is optional sugar behind a guarded import —
  see Conventions, "Vendored plugin imports". Ambient behavior plus the native
  tool namespace, never rule logic:
  - **W2 (ADR 0010)** — registers `mcp.servers.arggon`
    (`{type:"local",command:["arggon","mcp"]}`) **only when no `arggon` server
    is configured** and never clobbers one.
  - **Native tools W2 (ADR 0011, `task-native-tools`)** — registers the twelve
    `arggon` tools (`list`, `create`, `update`, `show`, `next`, `report`,
    `validate`, `comment`, `handoff`, `priority`, `sync`, `import_issues`) with
    `ctx.tool.transform`, `options.namespace: "arggon"` + `options.codemode:
    true`: Code Mode calls them as `tools.arggon.<name>` and `search` finds the
    namespace. Each tool calls the kernel **in-process** through `@arggon/lib`
    (the same `*Operation` the CLI's `--json` path uses) and returns the
    documented envelope; a kernel failure becomes an `ArgonToolError` (typed
    tool error carrying `code` + envelope) instead of a throw through a hook —
    the session continues (failure isolation). `@arggon/lib` is resolved with a
    guarded, cached dynamic import: the dependency-less adopter tree registers
    no tools until W3 vendors the single-file bundle. `create`/`import_issues`
    receive the `templatesDir` fallback resolved from the plugin location.
  - **W3 session context** — resolves the session's active item in this order:
    `ARGON_ITEM` env override → item ids observed from `arggon` invocations
    (shell commands, `arggon_*` MCP calls, Code Mode code) stored per session
    via `ctx.storage` → VCS branch (`feat/<id>` / `fix/<id>`). Observed shell
    invocations are anchored to command position: quoted mentions (`grep -rn
    "arggon show task-x"`, `echo "arggon update task-fake"`), quoted separators
    and single-quoted `$()` never correlate, while wrapper prefixes
    (`npx`/`bunx`/`sudo`/`env`/`command`/`time`), `$(…)`/subshell forms and
    newline-separated commands do; the Code Mode `arggon_*` regex stays a
    raw-source best effort (a call inside a string literal can correlate, then
    self-heals when `arggon show` disagrees). The branch read uses
    `ctx.vcs.get()` first and falls back to `git rev-parse --abbrev-ref HEAD`
    (probe: on 2.0.7 `vcs.get()` returns an empty `data.branch`), both
    `execFile` argument arrays. On every agent-loop model call it appends a
    bounded advisory block (`arggon show <id> --meta --json`, **≤ 1024 UTF-8
    bytes**, cached ~5 s) through `session.hook("context")` — per-call
    injection, so the block is present again after compaction. All plugin
    caches are bounded (256 entries, oldest-first) and the item cache is keyed
    by project directory + item id, so a long-lived `opencode serve` cannot
    cross-contaminate item views across projects. A claimed item
    (`in_progress` + assignee) renames the session to the item id
    (`ctx.session.update` on 2.0.7, where `ctx.session.rename` is absent);
    a recorded `worktree_path` is surfaced for `session_move` guidance. After a
    shell `git commit` it runs `arggon validate --json` and logs a warning on
    failure — never blocking; pre-commit/CI stay authoritative. No `tasks/`
    tree, no resolution, no CLI → the hook is silent. Evidence harness:
    `npm run smoke:opencode` (real headless `opencode run`) — it logs the
    injected text as `block=<json>` and measures those bytes independently
    (reported = measured, ≤ 1024) instead of trusting the reported count; exits
    0 with `skipped: opencode not installed` when absent.
- MCP (https://opencode.ai/v2/docs/mcp-servers/): V2 does not use `.mcp.json`
  as a registration mechanism — register the server under `mcp.servers` as
  `{ "type": "local", "command": ["arggon", "mcp"] }`; the generated
  `.mcp.json` still serves other clients (e.g. Claude Code). Check with
  `opencode mcp list` / `/mcps`.
- Skills (https://opencode.ai/v2/docs/skills/): `.agents/skills` is auto-discovered,
  so the bundled `arggon-cli` (an umbrella `SKILL.md` plus `references/` read on
  demand) and `arggon-upgrade` load with no config.
  Discovery order: `.claude/skills` → `.agents/skills` → global
  `~/.config/opencode/skills` → project `.opencode/skills` → explicit `skills`
  entries.
- Instructions (https://opencode.ai/v2/docs/instructions/): `AGENTS.md` is the
  only instruction mechanism (global plus every in-scope project `AGENTS.md`,
  combined). V2 **ignores `CLAUDE.md`** — the generated shim serves other tools,
  not V2 — and accepts but does not load the `instructions` config array.

## Conventions

- **Never invent V2 fields from the V1 schema.** V2 server names live under
  `mcp.servers` (never directly under `mcp`), servers switch off with `disabled`
  (there is no `enabled`), and V1-era keys (`autoupdate`, `tools`, `maxSteps`,
  `permission`) are wrong here. `https://opencode.ai/config.json` is the
  field-level source of truth.
- Config precedence (https://opencode.ai/v2/docs/config/): files merge farthest
  → closest, direct `opencode.json(c)` then `.opencode/opencode.json(c)`, so
  **every `.opencode` config overrides every direct config**. Hence the seam
  writes the root config and skips (reporting `opencode.jsonc` in `skipped[]`)
  when any adopter config exists, instead of adding an overriding one.
- Keep `.agents/skills/arggon-cli` as the single skill copy: a same-ID skill
  under project `.opencode/skills` would override it.
- File-based agents/commands: `.opencode/agents/*.md` (`mode: primary|subagent`,
  ordered `permissions` — last match wins) and `.opencode/commands/*.md` (only
  `.md` discovered; project files replace same-named global commands). Generated
  prompts drive the `arggon` CLI/MCP; they never restate the rules
  (https://opencode.ai/v2/docs/agents/, https://opencode.ai/v2/docs/commands/).
- Session context is **advisory and bounded**: the plugin injects at most one
  ≤ 1024-byte item block per model call (never the comment tail), `ARGON_ITEM`
  is read per call, and every surface is feature-detected — on 2.0.7
  `ctx.session.rename` and `ctx.vcs.branches` are absent, so the plugin uses
  `ctx.session.update` and `git` respectively. Correlation is anchored to
  command position and quoted text is inert; its caches are bounded
  (`CACHE_MAX_ENTRIES = 256`, oldest-first) and the item cache is keyed by
  project directory + item id. The tracker, pre-commit and CI remain the only
  authority; a missing surface degrades to a no-op.
- **Vendored plugin imports stay guarded.** The V2 plugin docs show a static
  `import { Plugin } from "@opencode/plugin"`; in a dependency-less tree (no
  `node_modules` — the `arggon init` adopter shape) an auto-discovered plugin
  using it fails to load on **2.0.7, 2.0.8 and 2.0.10** (`WARN failed to load
  plugin … Cannot find package '@opencode/plugin'`; `setup` never runs; the
  session still exits 0). The bundled plugin therefore exports a plain
  `{ id, setup }` object (a valid V2 definition) and resolves `Plugin.define`
  behind a guarded,
  computed dynamic import (computed so editors/`tsc` do not flag the
  deliberately absent package). Condition to simplify: only when the runtime
  resolves `@opencode/plugin` without a local `node_modules` (or the docs drop
  it) — re-run the A/B probe on the new 2.x first. Evidence: the PR #325 probe
  (2.0.7: static import fails, plain object loads),
  task-opencode-v2-plugin-import-gotcha (2.0.8 re-probe, same shape) and
  task-playbook-opencode-2-0-10 (2.0.10 re-probe, 2026-09-20, same shape: the
  docs plugin failed to load — `setup` marker absent — the bundled plugin
  loaded, registered `arggon` MCP and a real session executed `arggon_next`).
- **Code Mode batching.** V2 Code Mode exposes the MCP server as
  `tools.arggon.*` (probe: `tools.arggon.arggon_next({})`); batch read-only
  calls in ONE `execute` script (`arggon_next` + `arggon_show` +
  `arggon_report` + `arggon_validate`) instead of one model step per call.
  The schemas are advertised once per session and only the composed result
  enters the transcript — the ADR 0006 spirit applied to coordinators. The MCP
  tool catalog can lag server startup on a session's first model call: the
  2.0.10 re-probe got `Unknown tool 'arggon.arggon_next'` once and success on
  the immediate retry (smoke prompts have carried a one-retry line since W2 for
  this reason).
- **Transforms replay asynchronously (2.0.10).** `await ctx.tool.transform(cb)`
  resolves before `cb` runs: the runtime replays the registered callbacks when
  it rebuilds the registry (observed on 2.0.10 while registering the native
  tools — the editor callback ran on the next rebuild, after `setup` returned).
  Load external data before registering (the docs' rule), keep the callback
  cheap and repeatable, and never rely on a value the callback computed being
  available at `await` time; the plugin's registration log is therefore emitted
  from inside the first callback replay (deduped), not after `await`.

## Context budgets

The V2 prompt surface is measured, not assumed (ADR 0006, W6
`task-opencode2-context`):

- `npm run context:report` — report-only, no model calls. Runs `arggon init`
  on a temp fixture and prints bytes (plus `~bytes/4` tokens) for the
  generated `AGENTS.md`, the advertised skill/agent descriptions, the umbrella
  `SKILL.md` vs each `references/*.md`, the live MCP `tools/list` payload
  (reused from `arggon doctor --budget --json`), the plugin's injected item
  block and the generated compaction `keep.tokens`. `--json` emits the same
  numbers; `--strict` exits 1 when a bound is crossed. Gate scope (decided in
  `task-opencode2-context-polish`): `--strict` is a **manual/release gate**,
  not wired into CI — over `npm test` it adds the advisory MCP `tools/list`
  size, which drifts with the OpenCode/MCP schema instead of flagging a
  product regression, and the generated compaction `keep.tokens` regression
  check (expected 15,000), which no suite test enforces. Run it before a
  release and whenever a change touches a context surface (AGENTS.md, skills,
  agents, tool schemas).
- Enforced bounds: generated `AGENTS.md` ≤ 2048 B (test-enforced),
  injected item block ≤ 1024 B (`ITEM_BLOCK_MAX_BYTES`, per-field clipping),
  MCP `tools/list` ≤ 12,288 B advisory (`task-schema-budget`). The report
  flags crossings inline like `doctor --budget` does.
- Snapshot (2026-09-18, W6 report refreshed at merge — values move when the
  skills or tool schemas do, so re-run the report before relying on them):
  fixed per-session surface ~13.2 KB (~3.3k tokens) — MCP `tools/list`
  10,450 B is the dominant cost, AGENTS.md 1,863 B, advertised descriptions
  893 B total. The W5 skill split cut the on-load skill from 21,955 B (single
  file) to a 9,978 B umbrella, with the 17,208 B of references paid only when
  a task needs them. Those skill numbers are **source bytes** (this repo's
  `skills/arggon-cli/`, before marker stamping); the report's on-demand table
  prints **fixture bytes** after `arggon init` stamping (10,042 B umbrella,
  17,533 B references). Compare within one basis, never sum source and
  fixture numbers. `keep.tokens: 15000` matches the V2 default: retention is
  ~4.5x the fixed surface, so keep it unless exact recent detail matters more
  than new-work headroom.

## Testing

- Repo gates: `npm test` covers seam generation, never-overwrite/skip, JSONC
  validity and skill bundling parity; `arggon validate` covers tracker state.
- Fixture smoke: `arggon init` in a temp tree creates the seam; a second run
  leaves an edited `opencode.jsonc` byte-identical (adopter-owned); a tree with
  its own `opencode.json` reports the config skip and writes no `opencode.jsonc`.
- V2 session smoke: `opencode mcp list` shows `arggon` connected, the
  `arggon-cli` skill is discoverable and the `/arggon-*` commands are listed,
  and `arggon_next` resolves the next claimable item. Transcripts are the review
  evidence (ADR 0008 spirit); `npm run smoke:opencode` scripts it headless on
  temp fixtures (plugin load, MCP auto-registration + usability, never-clobber,
  failure isolation, plugin-absent CLI/MCP, and — W3 — item-block injection
  bounded to 1024 B from a `feat/<id>` branch, correlation from an observed
  `arggon_show` call, the `ARGON_ITEM` override, silence when nothing resolves
  or there is no `tasks/`, session rename, and the failing-`validate` commit
  warning) and exits 0 with `skipped: opencode not installed` when the binary
  is absent. The plugin's pure parsers/block builder are unit-tested without
  OpenCode next to the source (`opencode/plugins/arggon/index.test.ts`, run by
  the suite via the `opencode/**/*.test.ts` vitest include); the native tool
  namespace adds a contract suite (`opencode/plugins/arggon/tools.test.ts`)
  pinning each tool's output byte-for-byte against the CLI `--json` envelope
  (twin fixtures), the typed-error path and the ADR 0006 schema budget. The
  headless native-tools scenario links the workspace `@arggon/lib` into the
  fixture (building it when `lib/dist` is missing) and runs one Code Mode
  script that calls all twelve tools: contract envelopes, create→update
  round-trip, the typed `SYNC_FAILED`/`IMPORT_FAILED` tool errors while the
  session continues, and the namespace listed by
  `search({namespace:"arggon"})`. Compaction cannot be forced deterministically
  headless; the closest evidence is that the injection fires per model call (a
  later call in the same session gets the block again).
- Re-verified on 2.0.10 (2026-09-20, `opencode v2.0.10`): the 11 scenarios above
  pass unchanged, and the plugin-import A/B re-probe recorded in
  task-playbook-opencode-2-0-10 (dependency-less fixture — no `node_modules` in
  the fixture or any ancestor: plugin A, the docs static import, failed to load
  with `Cannot find package '@opencode/plugin'` and never wrote its setup
  marker; plugin B, the bundled guarded source, loaded, registered `arggon` MCP
  (`tools=9`; the fixture config registers no server) and executed
  `arggon_next` in a real session; the session still exited 0).

## Security

- The MCP surface is a local stdio server (`arggon mcp`): no listener, no ports.
  The `_meta.sessionID` V2 sends on tool calls is opaque correlation only —
  never authentication (https://opencode.ai/v2/docs/mcp-servers/).
- Command shell blocks (`` !`…` ``) run outside the agent's tool-permission flow
  and argument placeholders expand before execution: never place untrusted
  arguments in one. The generated commands use no shell blocks
  (https://opencode.ai/v2/docs/commands/).
- Remote MCP servers and HTTP skill catalogs are untrusted: keep secrets out of
  config (`{env:NAME}` substitution; OAuth credentials stay outside the
  project) and prefer safe same-origin catalog paths.
- `.opencode/**` artifacts are reviewable code: read prompts and permissions
  before trusting a session to them.

## Upgrade policy

- Re-research when `arggon playbook status` flags this file stale (default 90
  days) and on every new 2.x minor — 2.0.x is young, hooks/API can drift. Read
  the V2 docs and the config schema, never V1 docs, then
  `arggon playbook refresh opencode --version <v>`. Every 2.x refresh also
  re-runs the plugin-import A/B probe (dependency-less fixture; see Conventions)
  and refreshes the smoke evidence before trusting the documented static
  import.
- Field or shape changes land in `cli/src/docs.ts` + `templates/docs/opencode*`
  (and their tests) in the same PR as the refresh; no doc statement may
  contradict the shipped seam.
- Do not build on documented-inert V2 features (`instructions` array, agent
  `request` overlays, session sharing, `username`) — see the exploration's
  inert-surface table. The optional vendored plugin stays version-pinned and
  thin per [ADR 0010](../adr/0010-opencode2-native-architecture.md).
