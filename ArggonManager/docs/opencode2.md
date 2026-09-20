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
agents, the `arggon` MCP server (registered by the plugin when unset), the
native `arggon` Code Mode tools (registered by the plugin, calling the kernel
in-process), and — when your branch maps to a work item — a bounded
item-context block on every model call.

The day-to-day loop is unchanged and documented in
[`ArggonManager/docs/agents.md`](agents.md): find → claim → worktree → work → review → merge
→ done. OpenCode is simply the best runtime for it.

## What `arggon init` generates

| Artifact | What it is | Notes |
| --- | --- | --- |
| `opencode.jsonc` | Project config: `mcp.servers.arggon`, formatter, compaction retention | Generated **only when the repo has no OpenCode config** (root or `.opencode/`); otherwise reported in `skipped[]` |
| `.opencode/agents/arggon-{coordinator,worker,reviewer}.md` | The repo's orchestration model as V2 agents | Coordinator allow-list; worker nesting denied; reviewer `edit` denied |
| `.opencode/commands/arggon-*.md` | Ten workflow commands (`/arggon-next`, `-start`, `-done`, `-handoff`, `-review`, `-status`, `-spec`, `-adr`, `-explore`, `-playbook`) | Prompt templates driving the CLI/MCP; no shell blocks with arguments |
| `.opencode/plugins/arggon/` | Vendored plugin (ambient behavior + the native `arggon` tool namespace) | Bundled from the in-repo source with a byte-parity test |
| `.agents/skills/arggon-cli/` | Umbrella skill + `references/` (json-contract, methodology, orchestration, pitfalls) | Progressive disclosure: detail loads on demand |
| `AGENTS.md` | Slim router | V2 reads `AGENTS.md` only (no `CLAUDE.md` fallback) |

Everything generated flows through the repo's never-overwrite +
`x-generated` provenance machinery: untouched files refresh, modified files are
skipped (or archived with `init --backup`), and nothing is ever clobbered.

## The plugin (optional, failure-isolated)

`.opencode/plugins/arggon/` contributes ambient behavior plus the native tool
namespace:

- **Native `arggon` tools (ADR 0011, W2)** — registers twelve Code Mode tools
  (`tools.arggon.list`, `create`, `update`, `show`, `next`, `report`,
  `validate`, `comment`, `handoff`, `priority`, `sync`, `import_issues`) that
  call the kernel **in-process** through `@arggon/lib` and return the documented
  `--json` envelopes. A kernel failure becomes a typed tool error
  (`ArgonToolError`: kernel code + envelope) and the session continues. The
  kernel import is guarded: in a dependency-less adopter tree the namespace is
  simply absent until the vendored bundle lands (W3).
- **MCP auto-registration** — registers the `arggon` server only when no
  server is configured (never clobbers yours). The MCP stanza stays until W3
  drops it from the default path.
- **Session ↔ item correlation** — `ARGON_ITEM` env → observed `arggon` calls →
  `feat/<id>` / `fix/<id>` branch.
- **Bounded context** — injects an `arggon show --json`-shaped item block
  (≤ 1024 B) per model call, so it is present after compaction by construction.
- **Session ergonomics** — renames the session to the claimed item; surfaces
  the recorded `worktree_path` for `session_move`.
- **Hygiene signal** — logs a non-blocking warning when `arggon validate`
  fails after a commit (the pre-commit/CI gates stay authoritative).

Every path is wrapped: a plugin failure logs and no-ops. The CLI and MCP keep
working with the plugin broken or absent.

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
npm test                      # 1385+ tests
npm run smoke:opencode        # 12 headless scenarios on a real OpenCode runtime (incl. native tools)
npm run smoke:opencode:wave   # scripted coordinator/worker/reviewer wave (2 fixtures)
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

| | `mise.toml` | `mise.local.toml` |
| --- | --- | --- |
| Committed | yes | no — keep it out of git |
| Fresh clone | inherits the PATH | does not inherit |
| New worktree | inherits the PATH | does not inherit |
| Collaborators | inert path entry until they build their own shim | unaffected |

Use the tracked `mise.toml` for oc2 projects: work happens in worktrees, and an
untracked `mise.local.toml` silently disappears in every one of them — exactly
where sessions and workers run, bare `arggon` would fall back to `main`. Keep
`mise.local.toml` for personal overrides you do not want to impose.

### Why bare `arggon` must resolve per project

The generated seam calls bare `arggon` everywhere: the `arggon` MCP stanza in
`opencode.jsonc` (`{ "type": "local", "command": ["arggon", "mcp"] }`), the
plugin's MCP auto-registration when no server is configured, and the generated
agents/commands/skills that drive the CLI. If an oc2 project resolves it to
`main`, the session drives the wrong build.

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
  modified files), and the parity tests regenerate a missing or stale copy
  (`cli/src/plugin-copy.test.ts`, `cli/src/skill-copy.test.ts`). Until then
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

## Upgrading

- **The surface:** re-run `arggon init` — untouched artifacts refresh, modified
  ones are skipped, `--backup` archives before regenerating.
- **OpenCode itself:** refresh the playbook per its upgrade policy and re-run
  the A/B plugin-import probe on each 2.x minor.

## Where the program lives

| Document | Content |
| --- | --- |
| [`ArggonManager/docs/adr/0010-opencode2-native-architecture.md`](adr/0010-opencode2-native-architecture.md) | The architecture decision (two layers, one logic path, vendored-plugin policy) |
| [`ArggonManager/docs/specs/spec-opencode2-009.md`](specs/spec-opencode2-009.md) + [`ArggonManager/docs/plans/plan-opencode2-009.md`](plans/plan-opencode2-009.md) | Program contract and wave plan (implemented) |
| [`ArggonManager/docs/explorations/exploration-opencode-v2-native-009.md`](explorations/exploration-opencode-v2-native-009.md) | The research: V2 capability map, inert surfaces, candidates |
| [`ArggonManager/docs/playbooks/opencode.md`](playbooks/opencode.md) | Pinned version, conventions, testing, upgrade policy |
| `ArggonManager/arggon-manager/opencode2/` | Every work item with evidence, review verdicts and handoffs |

## FAQ

**Do I need OpenCode to use ArggonManager?** No. The CLI and MCP are portable;
the surface is additive.

**I already have an OpenCode config.** The config seam is skipped and
`arggon doctor` reports the exact MCP stanza to add if you want it. Your file
is never touched.

**Why is `main` untouched?** Product decision: this integration ships from
`opencode2`, which receives `main` merges as needed.

**Something looks wrong in a session.** Run `arggon doctor` (OpenCode section),
and check the playbook's troubleshooting notes; file findings as tracker
items, not GitHub issues.
