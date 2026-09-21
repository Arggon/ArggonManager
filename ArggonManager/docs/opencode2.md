# OpenCode2: native OpenCode V2 integration for ArggonManager

> **Status:** shipped on the **`opencode2`** branch. `main` is untouched by
> product decision — adopters who want the native OpenCode V2 experience use
> `opencode2`. This document is the entry point; the program record lives in
> the links at the bottom.

## What it is

Two layers, one logic path:

- **Portable core (unchanged).** The git-native tracker (`ArggonManager/`, legacy `tasks/`), the rules
  kernel, the CLI (`--json`) and the stdio MCP server. They work with any agent
  and any CI; nothing in the workflow requires OpenCode.
- **Native V2 surface (new, generated, zero-config, optional).** What
  `arggon init` writes into a repo plus the bundled plugin, so an OpenCode V2
  session gets the full ArggonManager workflow without configuration.

**One logic path:** every state transition goes through the kernel
(`cli/src/rules.ts` and the `run*` commands). The surface surfaces rules; it
never forks them.

## Quickstart

```bash
# 1. Get this branch (from an ArggonManager checkout)
git fetch origin && git checkout opencode2     # or: git worktree add ../AM-opencode2 opencode2
npm ci && npm run build                        # the `arggon` bin lives in dist/

# 2. Prepare YOUR repo (any repo, existing or new)
arggon init                                    # never overwrites adopter files

# 3. Open OpenCode V2 in the repo
opencode                                       # the seam is discovered automatically
```

Keeping `main` installed side-by-side (so bare `arggon` stays on `main`)? See
[Side-by-side installs](#side-by-side-installs).

Within the session you get: the `arggon-cli` skill (umbrella + on-demand
`references/`), the `/arggon-*` commands, the coordinator/worker/reviewer
agents, the native `arggon` Code Mode tools (registered by the vendored
single-file plugin, calling the inlined kernel in-process), the **TUI board
panel** (`/arggon-board` or Ctrl+P → _Open Arggon board_), and — when your
branch maps to a work item — a bounded item-context block on every model call.
MCP is optional and off the default path: `arggon mcp` and the generated
`.mcp.json` still serve other clients that configure it.

The day-to-day loop is unchanged and documented in
[`ArggonManager/docs/agents.md`](agents.md): find → claim → worktree → work → review → merge
→ done. OpenCode is simply the best runtime for it.

## What `arggon init` generates

| Artifact                                                   | What it is                                                                                                                                                                    | Notes                                                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `opencode.jsonc`                                           | Project config: formatter, compaction retention (no MCP stanza since W3) and the minimal shell gates (W4: no `--no-verify`, no force-push)                                    | Generated **only when the repo has no OpenCode config** (root or `.opencode/`); otherwise reported in `skipped[]`               |
| `.opencode/agents/arggon-{coordinator,worker,reviewer}.md` | The repo's orchestration model as V2 agents                                                                                                                                   | Coordinator subagent allow-list; worker nesting + `arggon.create` denied; reviewer `edit` denied and read-only shell gates (W4) |
| `.opencode/commands/arggon-*.md`                           | Eleven native commands (`/arggon-next`, `-start`, `-done`, `-handoff`, `-review`, `-status`, `-spec`, `-adr`, `-explore`, `-playbook`, `-adopt`)                              | Prompt templates driving the native tools (Code Mode `tools.arggon.*`); no CLI-driving prose, no shell blocks                   |
| `.opencode/plugins/arggon/`                                | Vendored **single-file** plugin bundle (kernel inlined; ambient behavior + the native `arggon` tool namespace) plus the vendored **TUI entry** `tui.tsx` (board/status panel) | Built from the in-repo source by `npm run build:plugin`; loads with no `node_modules`; drift-gated by `npm run check:plugin`    |
| `.agents/skills/arggon-cli/`                               | Umbrella skill + `references/` (json-contract, methodology, orchestration, pitfalls)                                                                                          | Progressive disclosure: detail loads on demand                                                                                  |
| `AGENTS.md`                                                | Slim router                                                                                                                                                                   | V2 reads `AGENTS.md` only (no `CLAUDE.md` fallback)                                                                             |

Everything generated flows through the repo's never-overwrite +
`x-generated` provenance machinery: untouched files refresh, modified files are
skipped (or archived with `init --backup`), and nothing is ever clobbered.

## The plugin (optional, failure-isolated)

`.opencode/plugins/arggon/` contributes ambient behavior plus the native tool
namespace:

- **Native `arggon` tools (ADR 0011, W2/W3)** — registers the twelve kernel
  tools (`tools.arggon.list`, `create`, `update`, `show`, `next`, `report`,
  `validate`, `comment`, `handoff`, `priority`, `sync`, `import_issues`) that
  call the kernel **in-process** (the bundle inlines `@arggon/lib`) and return
  the documented `--json` envelopes. The core tools are `options.pinned` (the
  W3 eight plus `start` from W4: nine) so the runtime keeps them in its Code
  Mode catalog; a kernel failure becomes a typed tool error (`ArgonToolError`:
  kernel code + envelope) and the session continues. The whole 15-definition
  payload measures 11,821 B ≤ 12,288 B advisory (ADR 0006; W7 re-measure,
  trimmed from the W4-era 12,182 B).
- **Worktree lifecycle tools (W4)** — `tools.arggon.start`, `branch` and
  `cleanup` own the item worktree through the V2 worktree domain
  (`ctx.worktree.create/list/remove`). `start` claims the item (kernel rules:
  never steal) and creates `../<repo>-<id>` (name `<repo>-<id>`), creates the
  convention branch inside it and records `branch` + `worktree_path` **in the
  worktree copy**, so the claim commit lands on the feature branch and the
  canonical checkout stays untouched — exactly like `arggon start --worktree`.
  `cleanup` classifies with the **shared kernel rule** (the same
  `classifyCleanupEntry` the CLI uses), removes merged worktrees through the
  domain, deletes their branches and clears the records in one tracker commit.
  Push and the `gh` PR step stay explicit agent steps; the CLI
  (`arggon start --worktree`, `arggon cleanup --prune`) is the documented
  fallback when the domain is unavailable.

  Payload contract (documented here; the output schemas stay loose to respect
  the ADR 0006 budget and the contract tests assert the envelopes):

  | Tool      | Payload fields (beyond `ok`/`schemaVersion`/`conventionVersion`/`command`)                                                                                                                    |
  | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `start`   | `id`, `branch`, `worktreePath` (`null` with `worktree: false`), `worktreeCreated`, `branchCreated`, `pushed`, `item` (the claimed contract item), `commit?` (tracker auto-commit)             |
  | `branch`  | `id`, `branch`, `item`, `commit?`                                                                                                                                                             |
  | `cleanup` | `base`, `candidates[]` (`id`, `status`, `branch`, `path`, `removable`, `reason`, `action`, `via?`), `pruned[]` (`id`, `action`, `error?`, `leftoverBranch?`, `via?`), `failures[]`, `commit?` |

  Failures are typed tool errors carrying the code + envelope: `START_FAILED`,
  `BRANCH_FAILED` and `CLEANUP_FAILED` (per-candidate prune failures stay in
  `pruned`/`failures`, like the CLI).

- **Permissions (W4)** — the generated seam adds minimal shell gates (deny
  `git commit --no-verify*`, `git push --force*`, `git push -f*`) that
  complement — never replace — the kernel invariants; the shipped agents add
  role gates (reviewer `edit`/subagent denied plus read-only shell gates;
  worker `arggon.create` denied; coordinator subagent allow-list). Native tool
  actions normalize to `<namespace>_<tool>` (`arggon_update`), MCP tools to
  `<server>_<tool>` (`arggon_arggon_update`): a `deny` removes the tool from
  the Code Mode catalog. The base policy stays allow-all, so ordinary and
  headless sessions are never blocked.
- **MCP is out of the default path (W3)** — the plugin no longer registers
  `mcp.servers.arggon` and never touches `ctx.mcp`; the generated config carries
  no MCP stanza. `arggon mcp` and `.mcp.json` remain for non-OpenCode clients
  that configure it explicitly (`doctor` reports a present stanza as optional).
- **TUI board and status (W5)** — `.opencode/plugins/arggon/tui.tsx` (the
  vendored TUI entry: OpenCode discovers it beside the server bundle) registers
  a `session.panel` contribution named `arggon.board` and a one-line
  `sidebar.content` status. The panel renders the current tree
  (initiative → epic → story → leaf) with per-item status glyphs, the
  dependency mark (`⌫deps`), the session's active item (`ARGON_ITEM` or the
  `feat/<id>`/`fix/<id>` branch) and the kernel `next` suggestion. `r` re-reads
  the tree, `f` toggles full-screen, `esc` closes. The data path is
  `board.ts` → the inlined kernel (no rule fork, no writes); the vendored TUI
  entry imports the board surface from the bundle relatively and lets the
  runtime resolve `solid-js`, so the adopter tree still needs no `node_modules`.
- **Session ↔ item correlation** — `ARGON_ITEM` env → observed `arggon` calls
  (shell invocations and Code Mode `tools.arggon.<name>(…)` calls) →
  `feat/<id>` / `fix/<id>` branch.
- **Bounded context** — injects an `arggon show --json`-shaped item block
  (≤ 1024 B) per model call, so it is present after compaction by construction.
- **Session ergonomics** — renames the session to the claimed item; surfaces
  the recorded `worktree_path` for `session_move`.
- **Hygiene signal** — logs a non-blocking warning when `arggon validate`
  fails after a commit (the pre-commit/CI gates stay authoritative).

Every path is wrapped: a plugin failure logs and no-ops. The CLI and MCP keep
working with the plugin broken or absent.

## TUI board and status (W5)

The board/status surface is a TUI plugin contribution, not a CLI screen: open a
session and run `/arggon-board` (Ctrl+P → _Open Arggon board_, or `ctrl+g`, also
work; outside a session the command toasts "open a session first"). The host
owns sizing/focus/full-screen; the plugin owns the content. The sidebar line
shows the active item (`arggon ▶ <id> <status>`) or `arggon · N ready · next
<id>`, where _ready_ follows the kernel definition (`isClaimable` + unclaimed
`todo` + all dependencies terminal). Without a tracker
the panel shows `no ArggonManager tracker found here`, and a corrupt tracker
(duplicate ids) shows `tracker unreadable: …` instead of crashing the slot —
the session keeps working in both cases.

**Manual checklist** (no interactive driver in CI — the automated evidence is
`npm run smoke:tui`, which drives exactly this flow in a PTY: init → tree →
`/arggon-board` → panel captured):

| Step                                                     | Expected                                                                                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open a session, run `/arggon-board`                      | Panel opens, header `arggon board · N item(s) · next: <id>`, counters line, indented tree (I/E/S/T/B badge + status glyph + id + title)                    |
| `esc`                                                    | Panel closes; the session view returns; nothing else changes                                                                                               |
| `f`                                                      | Presentation toggles to full-screen and back (host no-op on a narrow terminal — it is already full-screen)                                                 |
| `r`                                                      | Tree is re-read from disk (edits to items appear)                                                                                                          |
| Resize to a narrow terminal (< ~70 cols)                 | Panel stays full-screen, each line clips with `…`, no wrap/ghost                                                                                           |
| Sidebar (wide terminal, ~160 cols)                       | `arggon ▶ <active item> <status>` when the session resolves an item, else `arggon · N ready · next <id>`; the host hides the sidebar on narrower terminals |
| Open the TUI outside a tracker                           | `arggon board · no ArggonManager tracker found here`; session unaffected                                                                                   |
| Open the TUI with a corrupt tracker (duplicate item ids) | `arggon board · tracker unreadable: Duplicate id '…'`; no "crashed in slot" overlay, session unaffected                                                    |

## Guarantees

- **Never overwrite:** adopters own their files from the moment they exist.
- **One logic path:** no rule logic outside `cli/src/rules.ts`; the plugin and
  tools call the kernel.
- **Cross-agent:** CLI + MCP are first-class without OpenCode; ACP clients
  (Zed etc.) inherit the surface automatically.
- **Version discipline:** the playbook pins the tested OpenCode version
  (`ArggonManager/docs/playbooks/opencode.md`, currently 2.0.10) and records the known
  gotchas (e.g. the static `@opencode/plugin` import needs `node_modules`; the
  bundled plugin uses the guarded pattern).

## Verify it works

```bash
npm test                      # 1438+ tests
npm run smoke:opencode        # headless scenarios on a real OpenCode runtime: dependency-less bundle, one session per native command, the W4 worktree lifecycle + invariants + permissions
npm run smoke:opencode:wave   # scripted coordinator/worker/reviewer wave (2 fixtures)
npm run smoke:tui             # TUI evidence on a real runtime: init seam, plugin discovery, PTY run, /arggon-board opens and renders the tree
npm run context:report --strict   # context budgets: AGENTS.md, MCP schemas, item block, keep.tokens
```

## Side-by-side installs

Both branches declare the same `arggon` bin (`package.json` → `./dist/cli.js`),
so two `npm link` installs collide: the last one wins and the global shim
silently points at whichever checkout linked last. To keep `main` as bare
`arggon` and still drive the OpenCode2 build from this checkout, give the oc2
build a second name and let each project resolve it locally.

**Option A (recommended): named shim + per-project PATH.** Leave `arggon` →
`main`; add a wrapper for the oc2 checkout:

```bash
npm ci && npm run build        # dist/ is gitignored; build before shimming

mkdir -p ~/.local/share/arggon-oc2/bin
cat > ~/.local/share/arggon-oc2/bin/arggon <<'SH'
#!/usr/bin/env bash
exec node /home/<user>/Projects/ArggonManager-opencode2/dist/cli.js "$@"
SH
chmod +x ~/.local/share/arggon-oc2/bin/arggon
ln -sf ~/.local/share/arggon-oc2/bin/arggon ~/.local/bin/arggon-oc2
```

The wrapper `exec`s `node`, so it is immune to the `tsc` exec bit (see the dev
checkout notes below) and never touches the global `arggon`. It also needs
`~/.local/bin` on `PATH` for the `arggon-oc2` name.

Then make bare `arggon` resolve to the shim **inside the project** — a
`mise.toml` at the project root:

```toml
[env]
_.path = ["~/.local/share/arggon-oc2/bin"]
```

- mise prepends that directory ahead of the Node bin dir that owns the global
  `arggon`; verified with `mise exec -- which arggon` →
  `~/.local/share/arggon-oc2/bin/arggon`. Normal mode auto-trusts the config
  on `mise exec`; paranoid mode needs `mise trust`.
- The per-project PATH applies when mise is active in the shell
  (`mise activate`) or via `mise exec`; a plain shell still gets `main`.
- Both builds report `0.3.0`, so tell them apart by path
  (`readlink -f "$(which arggon)"`). Build identity is
  [`task-npm-packaging`](../arggon-manager/cli/install-ergonomics/task-npm-packaging.md)
  scope.

**Option B: frozen prefix install.** Pack the checkout into an isolated prefix
instead of linking it:

```bash
npm ci && npm run build        # neither install nor pack builds dist/
npm install -g --install-links --prefix ~/.local/share/arggon-oc2 <checkout>
ln -sf ~/.local/share/arggon-oc2/bin/arggon ~/.local/bin/arggon-oc2
```

- `--install-links` makes npm pack the directory instead of symlinking it;
  without it, npm 12 links `<checkout>` and the copy is not frozen (verified).
  Installing a tarball (`npm pack`, then
  `npm install -g --prefix ~/.local/share/arggon-oc2 <tarball>`) is
  equivalent. The tarball carries `dist/` because npm follows the declared
  `bin` into the gitignored directory (verified on npm 12.0.2).
- Neither install nor pack builds `dist/`, so build the checkout first
  (packaging debt: [`task-npm-packaging`](../arggon-manager/cli/install-ergonomics/task-npm-packaging.md)).

Option B also benefits from the same `mise.toml` snippet: both layouts expose
an `arggon` shim in `~/.local/share/arggon-oc2/bin`.

### `mise.toml` (tracked) vs `mise.local.toml` (machine-local)

|               | `mise.toml`                                      | `mise.local.toml`       |
| ------------- | ------------------------------------------------ | ----------------------- |
| Committed     | yes                                              | no — keep it out of git |
| Fresh clone   | inherits the PATH                                | does not inherit        |
| New worktree  | inherits the PATH                                | does not inherit        |
| Collaborators | inert path entry until they build their own shim | unaffected              |

Use the tracked `mise.toml` for oc2 projects: work happens in worktrees, and an
untracked `mise.local.toml` silently disappears in every one of them — exactly
where sessions and workers run, bare `arggon` would fall back to `main`. Keep
`mise.local.toml` for personal overrides you do not want to impose.

### Why bare `arggon` must resolve per project

The generated seam used to call bare `arggon` everywhere; W3 removed the MCP
stanza and the plugin's MCP auto-registration from the default path, so the
remaining runtime uses are the plugin's `arggon show` / `arggon validate`
fallbacks and the headless bootstrap/CI commands. If an oc2 project resolves
`arggon` to `main`, those fallbacks drive the wrong build.

The sharper caveat: **the OpenCode server spawns `arggon` with the PATH of the
shell that launched it**, not the project shell's. A background server started
elsewhere keeps resolving `main` even inside an oc2 project (observed:
`node …/node/26.7.0/bin/arggon mcp`, the global `main` link, spawned for the
oc2 checkout). Two fixes:

- Launch (or relaunch) OpenCode from a shell in the project with mise active:
  `cd <project> && opencode`.
- Or pin the absolute shim in the MCP command:
  `"command": ["/home/<user>/.local/share/arggon-oc2/bin/arggon", "mcp"]` —
  verified: the spawned server then runs the oc2 `dist/cli.js`. The path is
  machine-specific, so keep the pin out of shared configs.

### Dev checkout bootstrap

- `npm run build` is plain `tsc`, which emits `dist/cli.js` at mode `644`. A
  bare symlink to that file fails with `Permission denied`; `npm link` and
  `npm install -g` fix the mode (npm's bin links), and Option A's wrapper
  sidesteps the question (`exec node …` does not need the bit). Rebuild after
  every pull or branch switch — both shims execute `dist/`, which is
  gitignored.
- `.opencode/plugins/arggon/index.ts` and `.agents/skills/*` are gitignored
  generated copies of committed sources; a fresh dev checkout — and every new
  worktree — has none. `arggon init` regenerates them (never overwriting
  modified files), and the copy tests regenerate a missing or stale derived
  copy (`cli/src/plugin-copy.test.ts` — which also drift-gates the committed
  artifact — and `cli/src/skill-copy.test.ts`). Until then
  `Ctrl+P → Plugins` will not list `arggon`.

### Verify the side-by-side setup

```bash
# 1. the project shell resolves bare arggon to the oc2 shim
which arggon                    # → ~/.local/share/arggon-oc2/bin/arggon
readlink -f "$(which arggon)"   # → the shim (A) / <prefix>/lib/node_modules/…/dist/cli.js (B)

# 2. the plugin is discovered by the project's OpenCode server
#    TUI: Ctrl+P → Plugins → arggon (local, active)
opencode api plugin.list --param "location[directory]=$PWD"
# → {"id":"arggon","source":{"type":"local","path":"…/arggon/index.ts"},"state":{"status":"active"}}

# 3. the MCP server connects
opencode api mcp.list --param "location[directory]=$PWD"
# → {"name":"arggon","status":{"status":"connected"}}
```

The first `plugin.list` call may boot the location and race the plugin load —
run it twice, or start a session in the project first.

## Headless bootstrap and CI (no model, no MCP)

The packaged `arggon` bin keeps `init` / `validate` / `doctor` / `--json` for
bootstrap and model-less CI (ADR 0011: a plugin cannot create the repo it lives
in and CI has no model). `arggon init` vendors the adopter workflow to
`.github/workflows/arggon.yml` — install the bin, then
`arggon init --no-commit` → `arggon validate --json` (plus `doctor`/`list`
diagnostics), with an optional drift gate on the committed seam. Nothing in
that flow touches OpenCode, a model or MCP: the tracker and the bin are enough.
Full recipe, install variants (the two packages are still `private`) and the
fixture that exercises it: [`ArggonManager/docs/ci.md`](ci.md).

## Upgrading

- **The surface:** re-run `arggon init` — untouched artifacts refresh, modified
  ones are skipped, `--backup` archives before regenerating.
- **OpenCode itself:** refresh the playbook per its upgrade policy and re-run
  the A/B plugin-import probe on each 2.x minor.

## Where the program lives

| Document                                                                                                                                                          | Content                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`ArggonManager/docs/adr/0010-opencode2-native-architecture.md`](adr/0010-opencode2-native-architecture.md)                                                       | The architecture decision (two layers, one logic path, vendored-plugin policy)            |
| [`ArggonManager/docs/specs/spec-opencode2-009.md`](specs/spec-opencode2-009.md) + [`ArggonManager/docs/plans/plan-opencode2-009.md`](plans/plan-opencode2-009.md) | Program contract and wave plan (implemented)                                              |
| [`ArggonManager/docs/explorations/exploration-opencode-v2-native-009.md`](explorations/exploration-opencode-v2-native-009.md)                                     | The research: V2 capability map, inert surfaces, candidates                               |
| [`ArggonManager/docs/playbooks/opencode.md`](playbooks/opencode.md)                                                                                               | Pinned version, conventions, testing, upgrade policy                                      |
| [`ArggonManager/docs/ci.md`](ci.md)                                                                                                                               | Headless bootstrap and CI: the packaged bin, the adopter workflow, the model-less fixture |
| `ArggonManager/arggon-manager/opencode2/`                                                                                                                         | Every work item with evidence, review verdicts and handoffs                               |

## FAQ

**Do I need OpenCode to use ArggonManager?** No. The CLI and MCP are portable;
the surface is additive.

**I already have an OpenCode config.** The config seam is skipped and your file
is never touched; the vendored plugin still delivers the native `arggon` tools.
If your config carries an `arggon` MCP stanza, `arggon doctor` reports it as
optional (the native tools do not need it; keep it only for other clients).

**Why is `main` untouched?** Product decision: this integration ships from
`opencode2`, which receives `main` merges as needed.

**Something looks wrong in a session.** Run `arggon doctor` (OpenCode section),
and check the playbook's troubleshooting notes; file findings as tracker
items, not GitHub issues.
