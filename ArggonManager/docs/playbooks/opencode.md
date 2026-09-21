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
  `.opencode/opencode.json(c)`) — formatter + compaction retention and **no MCP
  stanza** (W3, `task-native-commands-seam`; ADR 0011 §5/§6) — plus
  `.opencode/agents/arggon-{coordinator,worker,reviewer}.md` and the eleven
  native `.opencode/commands/arggon-{next,start,done,handoff,review,status,spec,adr,explore,playbook,adopt}.md`
  — never overwriting modified files (contract:
  [spec-opencode-seam-010](../specs/spec-opencode-seam-010.md)). The commands are
  prompt templates that drive the native tools and write the methodology
  artifacts directly; they carry no CLI-driving prose and no shell blocks.
- `arggon init` vendors the plugin at `.opencode/plugins/arggon/index.ts`
  (auto-discovered, zero config). Since W3 it is the **single-file,
  dependency-free bundle** built from `opencode/plugins/arggon/index.ts` with
  `@arggon/lib` inlined (`npm run build:plugin`; the artifact is committed and
  drift-gated by `npm run check:plugin` in CI), so a fresh adopter tree needs
  no `node_modules`. Since W5 (`task-native-tui`) it also vendors the **TUI
  entry** `.opencode/plugins/arggon/tui.tsx` beside it (OpenCode discovers the
  TUI entry from the same plugin directory; the runtime resolves `solid-js` and
  the board surface arrives through a relative `./index.ts` import — still no
  `node_modules`). It is
  failure-isolated (every path logs once and no-ops, never breaking a
  session/CLI/MCP). Ambient behavior plus the native tool namespace, never rule
  logic:
  - **Native tools W2/W3/W4 (ADR 0011, `task-native-tools`,
    `task-native-permissions-worktrees`)** — registers the fifteen `arggon`
    tools (`list`, `create`, `update`, `show`, `next`, `report`, `validate`,
    `comment`, `handoff`, `priority`, `sync`, `import_issues`, plus the
    worktree lifecycle `start`, `branch`, `cleanup`) with
    `ctx.tool.transform`, `options.namespace: "arggon"` + `options.codemode:
true`: Code Mode calls them as `tools.arggon.<name>` and `search` finds the
    namespace. Each tool calls the kernel **in-process** (the bundle's inlined
    `@arggon/lib`; the same `*Operation` the CLI's `--json` path uses) and
    returns the documented envelope; a kernel failure becomes an `ArgonToolError`
    (typed tool error carrying `code` + envelope) instead of a throw through a
    hook — the session continues (failure isolation). The core nine
    (`list`, `create`, `update`, `show`, `next`, `validate`, `comment`,
    `handoff`, plus W4's `start`) also set `options.pinned: true` (W3/W4 catalog
    lever, see Conventions); `create`/`import_issues` receive the `templatesDir`
    fallback resolved from the plugin location (ADR 0013).
  - **MCP is out of the default path (W3)** — the plugin no longer registers
    `mcp.servers.arggon` and never touches `ctx.mcp`; `arggon mcp` and the
    generated `.mcp.json` stay for non-OpenCode clients that configure it
    explicitly. `doctor` reports a present stanza as optional.
  - **W3 session context** — resolves the session's active item in this order:
    `ARGON_ITEM` env override → item ids observed from `arggon` invocations
    (shell commands, Code Mode `tools.arggon.<name>(…)` native calls — W3 — and
    the transitional `arggon_*` MCP spelling) stored per session via
    `ctx.storage` → VCS branch (`feat/<id>` / `fix/<id>`). Observed shell
    invocations are anchored to command position: quoted mentions (`grep -rn
"arggon show task-x"`, `echo "arggon update task-fake"`), quoted separators
    and single-quoted `$()` never correlate, while wrapper prefixes
    (`npx`/`bunx`/`sudo`/`env`/`command`/`time`), `$(…)`/subshell forms and
    newline-separated commands do; the Code Mode call regexes stay a raw-source
    best effort (a call inside a string literal can correlate, then self-heals
    when `arggon show` disagrees). The branch read uses
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
- MCP (https://opencode.ai/v2/docs/mcp-servers/) is **optional** in V2 and not
  part of the default seam (W3): the native tools replace it. To use the stdio
  server with another client, register it under `mcp.servers` as
  `{ "type": "local", "command": ["arggon", "mcp"] }`; the generated
  `.mcp.json` serves non-OpenCode clients (e.g. Claude Code). Check with
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
- **Vendored plugin imports stay guarded, and W3 ships a bundle.** The V2
  plugin docs show a static `import { Plugin } from "@opencode/plugin"`; in a
  dependency-less tree (no `node_modules` — the `arggon init` adopter shape) an
  auto-discovered plugin using it fails to load on **2.0.7, 2.0.8 and 2.0.10**
  (`WARN failed to load plugin … Cannot find package '@opencode/plugin'`;
  `setup` never runs; the session still exits 0). Since W3 the vendored artifact
  is the **generated single-file bundle**
  (`opencode/plugins/arggon/index.bundle.ts` → `.opencode/plugins/arggon/index.ts`),
  built by `npm run build:plugin` from the source with `@arggon/lib` inlined:
  every reachable module is transpiled to CommonJS with the TypeScript compiler
  API (no bundler dependency) and wrapped in a tiny ESM module registry, so the
  only bare import left is `node:module`. The plain `{ id, setup }` default
  export is a valid V2 definition; `Plugin.define` is not imported at all (the
  guarded sugar needed a top-level await the bundle cannot carry). The artifact
  is committed because `init` must work from a source checkout without a build;
  `cli/src/plugin-copy.test.ts` **drift-gates** it (asserts the committed bytes
  equal the deterministic build _before_ touching anything, so a source change
  without `npm run build:plugin` fails the suite) and `npm run check:plugin`
  enforces the same gate in CI; `opencode/plugins/arggon/bundle.test.ts` loads
  the committed artifact from a temp dir with no `node_modules` and calls every
  tool. Evidence: the PR #325 probe
  (2.0.7: static import fails, plain object loads),
  task-opencode-v2-plugin-import-gotcha (2.0.8 re-probe, same shape),
  task-playbook-opencode-2-0-10 (2.0.10 re-probe, same shape) and
  task-native-commands-seam (W3: dependency-less bundle load + 12 native tools)
  and task-native-permissions-worktrees (W4: 15 tools, worktree domain
  lifecycle + permission defaults).
- **`options.pinned` (W3 catalog lever).** The runtime draws a subset of the
  Code Mode catalog under its own ~2000-token budget; 2.0.10 registers its own
  `session_move` tool with `options.pinned: true` (undocumented in the plugin
  docs, probe 2026-09-20). The plugin pins the **core nine** workflow tools
  (`list`, `create`, `update`, `show`, `next`, `validate`, `comment`, `handoff`,
  plus W4's `start`, the claim → worktree entry `/arggon-start` drives) and
  leaves the maintenance tools (`report`, `priority`, `sync`, `import_issues`,
  `branch`, `cleanup`) unpinned — still reachable through `search`. Pinning
  everything would force entries out of a budget the runtime cannot render
  alongside other plugins' tools, so the core subset is the measured
  compromise; `context:report` prints the pinned count and `tools.test.ts` pins
  the exact subset. W4 keeps the definitions payload within the ADR 0006
  advisory by shipping the three worktree tools with lean schemas (bare output
  schema; the payload is at 12,182 B ≤ 12,288 B). Treat the option as
  feature-detected: unknown options are ignored, never fatal.
- **TUI plugins (W5 `task-native-tui` — probes 2026-09-21 on the local
  2.0.12).** The TUI entry point lives beside the server entry in the plugin
  directory (`<project>/.opencode/plugins/<name>/tui.tsx` next to `index.ts`)
  and is discovered automatically (a published package exports `./tui`
  instead). The runtime transpiles TSX and resolves the runtime packages
  itself: a dependency-less fixture loaded a `tui.tsx` importing `solid-js`
  with no `node_modules` (the runtime's internal mapping covers
  `@opencode/plugin/tui`, `@opentui/solid*` and `solid-js`), and relative
  imports between the plugin's files work — the vendored TUI entry imports the
  server bundle `./index.ts` including its `createRequire(import.meta.url)`
  wrapper. Probes:
  - `setup(context)` receives `options, location, app, renderer, client, data,
attention, theme, themeMode, markdown, keymap, storage, ui`; returning a
    disposer unregisters the slot contributions.
  - `context.ui.slot({ append: "session.panel", render })` registers the panel
    contribution; the host passes `{name, sessionID, width, presentation,
focused, close, toggleFullscreen, focus}`. `context.ui.panel.open(name)`
    opens the panel **inside a session** and returns `false` outside one (branch
    on the return value instead of assuming success). Names are shared
    selection values: prefix them (`arggon.board`) to avoid collisions, and
    guard the render with `Show when={panel.name === …}` as documented.
  - `context.keymap.layer(…)` requires a mounted keymap provider: calling it
    directly in `setup` throws `Keymap.Provider is missing`. Register the
    global command layer inside a slot render (the `app` slot is the documented
    host); panel-scoped bindings belong to the panel component.
  - The board read is **total**: `boardSnapshot` degrades to an error snapshot
    for both a missing tracker (`no ArggonManager tracker found here`) and a
    corrupt one (`tracker unreadable: Duplicate id '…'` — `itemsById` throws
    there, and the guard is what keeps the host from showing
    `Plugin arggon.tui crashed in slot session.panel`), with a per-surface
    try/catch as belt-and-braces. Unit tests cover both, and `smoke:tui`
    reproduces the duplicate-id case end-to-end in the PTY.
  - Dispatch (verified with the shipped plugin on 2.0.12): inside a session the
    panel opens from the slash command `/arggon-board`, from the palette entry
    (Ctrl+P → _Open Arggon board_) **and** from the `ctrl+g` binding registered
    in the `app` slot; on the home screen the binding runs the command but
    `panel.open` returns `false`, which the plugin turns into the toast
    "arggon board: open a session first" (documented fallback, not a crash).
  - Narrow terminals stay full-screen (the host decides); `toggleFullscreen` is
    a no-op until there is room for a side panel. Size the panel lines from
    `panel.width` and clip them yourself.
  - The TUI runs locally in the terminal process with filesystem access (the
    W5 board surface reads the tracker through the inlined kernel), so the panel
    needs no server round-trip and stays display-only.
  - Evidence: `npm run smoke:tui` (PTY via util-linux `script`: init fixture →
    4-item tree → `opencode plugin list` → API-created empty session → TUI run
    → types `/arggon-board` → asserts the captured panel header + tree, no
    plugin load failure, and that a duplicate-id tracker renders the unreadable
    header instead of a slot crash). Unit wiring:
    `opencode/plugins/arggon/tui.test.ts` + `board.test.ts` with the runtime
    stubs in `test/tui-runtime-stub.ts` (vitest aliases
    `solid-js`/`@opentui/solid/jsx-runtime`, oxc `jsx` config); the strict type
    gate (`cli/tsconfig.plugin.json` + `cli/types/tui-runtime.d.ts`) now covers
    `tui.tsx` too.
  - Version note: the W5 probes ran on the local **2.0.12** while this playbook
    pins 2.0.10 and the W5 surfaces were not re-probed on 2.0.10 (they use only
    documented 2.0.x APIs, feature-detected). A pin refresh on the installed 2.x
    is a coordinator call (pin + A/B re-probe per the upgrade policy).
- **Code Mode batching.** V2 Code Mode exposes the native namespace as
  `tools.arggon.*` (W3 default: `tools.arggon.next({})`, `tools.arggon.show`,
  `tools.arggon.report`, `tools.arggon.validate`); batch read-only calls in ONE
  `execute` script instead of one model step per call. While an adopter still
  registers the MCP server, its tools appear alongside as
  `tools.arggon.arggon_*` (probe: `tools.arggon.arggon_next({})`).
  The schemas are advertised once per session and only the composed result
  enters the transcript — the ADR 0006 spirit applied to coordinators. The MCP
  tool catalog can lag server startup on a session's first model call: the
  2.0.10 re-probe got `Unknown tool 'arggon.arggon_next'` once and success on
  the immediate retry (smoke prompts have carried a one-retry line since W2 for
  this reason).
- **Worktree domain (W4, task-native-permissions-worktrees).** `ctx.worktree`
  exposes `create/list/refresh/remove/transform` on 2.0.10; probes recorded
  (fixture repo, `opencode run --standalone`):
  - every operation requires `projectID` (`ctx.location.project.id`) and loads
    configuration from the project's saved `canonical` checkout; the plugin
    context has `ctx.location.project.{id,directory,canonical}`.
  - `create({ projectID, name, directory })` treats `directory` as the PARENT
    (relative paths resolve against the canonical checkout, absolute paths as
    given) and returns the actual directory; the name is collision-suffixed
    (`collide` → `collide-2`). Without `worktree.directory` config the default
    is the server data dir (`~/.local/share/opencode/worktree/<first-6-of-project-id>/`).
  - the built-in Git strategy checks out a DETACHED worktree at the start ref
    (`branch` is a start ref, not `-b`: an unknown ref fails with
    `fatal: invalid reference`), so creating/switching the item branch is the
    caller's job (`git switch -c <branch>` inside the worktree is the
    equivalent of the CLI's `git worktree add -b`).
  - `list` reads SAVED inventory only (a `git worktree add` directory is
    invisible until `refresh`); `remove` works for any worktree of the project
    (including git-created ones), `force` is required for dirty trees.
  - `ctx.permission.rules` (the documented session-scoped rule setter) is
    **absent on 2.0.10** — `ctx.permission.list/get/reply` exist. Do not build
    on it; feature-detect if a 2.x adds it back.
  - attach safety (W4 review): both attach paths (the recorded `worktree_path`
    and the deterministic `../<repo>-<id>` default) require the directory to be
    a worktree registered with THIS repo — a foreign repository at that path is
    refused before any branch is created/switched; a rollback removes only the
    worktree the run created and deletes only a branch the run created, so a
    pre-existing (unmerged) branch survives a refused claim.
  - the native `start` tool is a deliberate subset of `arggon start --worktree`:
    it does not link the primary checkout's `node_modules` and does not run the
    `x-worktree.post-start` hook (the domain creates a plain worktree from the
    canonical HEAD). The agent bootstraps the worktree explicitly when the
    project gates need it (`npm ci`, `uv sync`, …); the CLI remains the
    full-featured fallback. A domain-native bootstrap hook is a candidate
    follow-up (W5/W7).
- **Permission action names (W4 probes).** A native plugin tool is gated as
  `<namespace>_<tool>` (`arggon_update`, probe: a `deny` removes
  `tools.arggon.update` from the Code Mode catalog — the model gets
  `Unknown tool 'arggon.update'`); an MCP tool as `<server>_<tool>`
  (`arggon_arggon_update`). `shell` rules match the scanner's command string
  (`git push *` denies `git push origin main` with `Permission denied: shell`
  while `git status` still runs). The shipped defaults are deliberately
  non-breaking: no global `ask` (headless clients would stall), only narrow
  `deny`s (force-push, `--no-verify`, reviewer mutations).
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
- Snapshot (2026-09-20, W4 `task-native-permissions-worktrees` — values move
  when the skills or tool schemas do, so re-run the report before relying on
  them): MCP `tools/list` 10,507 B and the native `arggon` definitions
  12,182 B (15 tools, 9 pinned) are the dominant costs, generated AGENTS.md
  ~2.0 KB, advertised descriptions ~0.9 KB total. The W5 skill split cut the on-load skill from 21,955 B (single file) to
  an 11,942 B fixture umbrella, with the 18,100 B of references paid only when
  a task needs them. Those skill numbers are **source bytes** (this repo's
  `skills/arggon-cli/`, before marker stamping); the report's on-demand table
  prints **fixture bytes** after `arggon init` stamping. Compare within one
  basis, never sum source and fixture numbers. The MCP surface still exists for
  other clients, so the report keeps measuring it; on the W3 default path it is
  not registered, so a real adopter session does not pay it. `keep.tokens:
15000` matches the V2 default: retention is ~2.5x the fixed surface, so keep
  it unless exact recent detail matters more than new-work headroom.
- **W5 (`task-native-tui`) adds no prompt-side surface.** The TUI panel/sidebar
  registration contributes no tool schema and no instruction or skill bytes, so
  the measured ADR 0006 surfaces are byte-identical before/after: `AGENTS.md`
  2,005 B, native `arggon` definitions 12,182 B (15 tools, 9 pinned), MCP
  `tools/list` 10,507 B, `fixedTotalBytes` 25,636 B, item block ≤ 1,024 B
  (measured 2026-09-21, `context:report` before/after). The only number that
  moves is `doctor.initTreeBytes` (411,370 → 434,227 B): the on-disk size of the
  vendored seam — the bundle now inlines the board surface and the TUI entry is
  vendored beside it — not a model-context surface.

## Testing

- Repo gates: `npm test` covers seam generation, never-overwrite/skip, JSONC
  validity and skill bundling parity; `arggon validate` covers tracker state.
  W5 adds the TUI board/status surface: `opencode/plugins/arggon/board.test.ts`
  (kernel-backed snapshot/tree/line renderers on a fixture tracker, purity,
  hostile-byte escaping and the duplicate-id degradation), `tui.test.ts`
  (slot/command/panel wiring against the runtime stubs, the corrupt-tracker
  panel render, plus the vendored-source import allowlist),
  `cli/src/plugin-copy.test.ts` (bundle drift gate, the `BUNDLE_EXPORTS`
  allowlist ⇄ `tui.tsx` imports parity, and the self-healing derived copies of
  both vendored files) and the extended `bundle.test.ts` (the dependency-less
  bundle serves the board surface from the inlined kernel). `npm run smoke:tui`
  is the PTY end-to-end evidence (init → tree → plugin discovery → session →
  `/arggon-board` → captured panel → duplicate-id degradation).
- Fixture smoke: `arggon init` in a temp tree creates the seam; a second run
  leaves an edited `opencode.jsonc` byte-identical (adopter-owned); a tree with
  its own `opencode.json` reports the config skip and writes no `opencode.jsonc`.
- V2 session smoke: the `arggon-cli` skill is discoverable, the `/arggon-*`
  commands are listed, and `tools.arggon.next` resolves the next claimable item.
  Transcripts are the review evidence (ADR 0008 spirit); `npm run smoke:opencode`
  scripts it headless on temp fixtures (plugin load, no MCP stanza in the fresh
  seam, dependency-less bundle registering the fifteen native tools, never-clobber,
  failure isolation, plugin-absent CLI, **one bounded headless session per native
  command** (eleven: next/start/done/handoff/review/status/spec/adr/explore/
  playbook/adopt), item-block injection bounded to 1024 B from a `feat/<id>`
  branch, correlation from an observed native `tools.arggon.show` call, the
  `ARGON_ITEM` override, silence when nothing resolves or there is no `tasks/`,
  session rename, the failing-`validate` commit warning, and the W4 scenarios:
  the full claim → worktree → commit → stubbed-PR → done → cleanup round-trip
  through the native tools, the never-steal/no-reopen invariants with the
  generated permissions active (a real `arggon-worker` session) and the
  reviewer gates (every mutating native tool absent from the Code Mode catalog,
  `git push` denied against a planted local `origin`, inspection still working))
  and exits 0 with
  `skipped: opencode not installed` when the binary is absent. Both this
  harness and the orchestration wave (`npm run smoke:opencode:wave`,
  `docs/agents.md` §Orchestration) are **model-driven and timing sensitive: run
  each one alone** — a concurrent suite or another headless harness can stall a
  provider call past the per-command timeout and leave a scenario half-done
  (deterministic gates are safe to run in parallel). The plugin's pure parsers/block builder are unit-tested without
  OpenCode next to the source (`opencode/plugins/arggon/index.test.ts`, run by
  the suite via the `opencode/**/*.test.ts` vitest include); the native tool
  namespace adds a contract suite (`opencode/plugins/arggon/tools.test.ts`)
  pinning every tool's output byte-for-byte against the CLI `--json` envelope
  (twin fixtures; the GitHub-dependent `sync`/`import_issues` cases run a fake
  `gh` shim on PATH, so no network or gh auth is involved), the typed-error
  path and the ADR 0006 schema budget. `typecheck.test.ts` closes the gap the
  root tsconfig leaves (it includes `cli/src` only) by running strict
  `tsc --noEmit` over the vendored plugin source — the file `arggon init`
  copies into every adopter tree — because vitest transpiles without
  type-checking and eslint is not type-aware. `opencode/plugins/arggon/bundle.test.ts`
  regenerates the bundle and loads it from a temp dir with no `node_modules`,
  runs `setup()` and calls tools end to end (the deterministic proof of the
  dependency-less adopter shape). The headless native-tools scenario stays
  dependency-less (the kernel is inlined in the vendored bundle) and runs one
  Code Mode script that calls all twelve kernel tools: contract envelopes, create→update
  round-trip, the typed `SYNC_FAILED`/`IMPORT_FAILED` tool errors while the
  session continues, and the namespace listed by
  `search({namespace:"arggon"})`. Compaction cannot be forced deterministically
  headless; the closest evidence is that the injection fires per model call (a
  later call in the same session gets the block again).
- Re-verified on 2.0.10 (2026-09-20, `opencode v2.0.10`): the plugin-import
  A/B re-probe recorded in task-playbook-opencode-2-0-10 (dependency-less
  fixture — no `node_modules` in the fixture or any ancestor: plugin A, the docs
  static import, failed to load with `Cannot find package '@opencode/plugin'`
  and never wrote its setup marker; plugin B loaded and executed a real session;
  the session still exited 0). W3 (`task-native-commands-seam`) re-ran the whole
  harness against the generated bundle: fresh-init seam without MCP, fifteen
  native tools registered in a dependency-less fixture, one bounded headless
  session per native command, and native `tools.arggon.show` correlation.

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
