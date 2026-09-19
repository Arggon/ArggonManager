# OpenCode2: native OpenCode V2 integration for ArggonManager

> **Status:** shipped on the **`opencode2`** branch. `main` is untouched by
> product decision — adopters who want the native OpenCode V2 experience use
> `opencode2`. This document is the entry point; the program record lives in
> the links at the bottom.

## What it is

Two layers, one logic path:

- **Portable core (unchanged).** The git-native `tasks/` tracker, the rules
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

Within the session you get: the `arggon-cli` skill (umbrella + on-demand
`references/`), the `/arggon-*` commands, the coordinator/worker/reviewer
agents, the `arggon` MCP server (registered by the plugin when unset), and —
when your branch maps to a work item — a bounded item-context block on every
model call.

The day-to-day loop is unchanged and documented in
[`docs/agents.md`](agents.md): find → claim → worktree → work → review → merge
→ done. OpenCode is simply the best runtime for it.

## What `arggon init` generates

| Artifact | What it is | Notes |
| --- | --- | --- |
| `opencode.jsonc` | Project config: `mcp.servers.arggon`, formatter, compaction retention | Generated **only when the repo has no OpenCode config** (root or `.opencode/`); otherwise reported in `skipped[]` |
| `.opencode/agents/arggon-{coordinator,worker,reviewer}.md` | The repo's orchestration model as V2 agents | Coordinator allow-list; worker nesting denied; reviewer `edit` denied |
| `.opencode/commands/arggon-*.md` | Ten workflow commands (`/arggon-next`, `-start`, `-done`, `-handoff`, `-review`, `-status`, `-spec`, `-adr`, `-explore`, `-playbook`) | Prompt templates driving the CLI/MCP; no shell blocks with arguments |
| `.opencode/plugins/arggon/` | Vendored plugin (ambient behavior only) | Bundled from the in-repo source with a byte-parity test |
| `.agents/skills/arggon-cli/` | Umbrella skill + `references/` (json-contract, methodology, orchestration, pitfalls) | Progressive disclosure: detail loads on demand |
| `AGENTS.md` | Slim router | V2 reads `AGENTS.md` only (no `CLAUDE.md` fallback) |

Everything generated flows through the repo's never-overwrite +
`x-generated` provenance machinery: untouched files refresh, modified files are
skipped (or archived with `init --backup`), and nothing is ever clobbered.

## The plugin (optional, failure-isolated)

`.opencode/plugins/arggon/` contributes **ambient behavior only**:

- **MCP auto-registration** — registers the `arggon` server only when no
  server is configured (never clobbers yours).
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
  (`docs/playbooks/opencode.md`, currently 2.0.8) and records the known
  gotchas (e.g. the static `@opencode/plugin` import needs `node_modules`; the
  bundled plugin uses the guarded pattern).

## Verify it works

```bash
npm test                      # 1293+ tests
npm run smoke:opencode        # 11 headless scenarios on a real OpenCode runtime
npm run smoke:opencode:wave   # scripted coordinator/worker/reviewer wave (2 fixtures)
npm run context:report --strict   # context budgets: AGENTS.md, MCP schemas, item block, keep.tokens
```

## Upgrading

- **The surface:** re-run `arggon init` — untouched artifacts refresh, modified
  ones are skipped, `--backup` archives before regenerating.
- **OpenCode itself:** refresh the playbook per its upgrade policy and re-run
  the A/B plugin-import probe on each 2.x minor.

## Where the program lives

| Document | Content |
| --- | --- |
| [`docs/adr/0010-opencode2-native-architecture.md`](adr/0010-opencode2-native-architecture.md) | The architecture decision (two layers, one logic path, vendored-plugin policy) |
| [`docs/specs/spec-opencode2-009.md`](specs/spec-opencode2-009.md) + [`docs/plans/plan-opencode2-009.md`](plans/plan-opencode2-009.md) | Program contract and wave plan (implemented) |
| [`docs/explorations/exploration-opencode-v2-native-009.md`](explorations/exploration-opencode-v2-native-009.md) | The research: V2 capability map, inert surfaces, candidates |
| [`docs/playbooks/opencode.md`](playbooks/opencode.md) | Pinned version, conventions, testing, upgrade policy |
| `tasks/arggon-manager/opencode2/` | Every work item with evidence, review verdicts and handoffs |

## FAQ

**Do I need OpenCode to use ArggonManager?** No. The CLI and MCP are portable;
the surface is additive.

**I already have an OpenCode config.** The config seam is skipped and
`arggon doctor` reports the exact MCP stanza to add if you want it. Your file
is never touched.

**Why is `main` untouched?** Product decision: this integration ships from
`opencode2`, which receives `main` merges as needed.

**Something looks wrong in a session.** Run `arggon doctor` (OpenCode section),
and check the playbook's troubleshooting notes; file findings as `tasks/`
items, not GitHub issues.
