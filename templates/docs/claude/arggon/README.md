# arggon — ArggonManager native seam for Claude Code

This directory is the vendored declarative plugin `arggon init` generates for
Claude Code (ADR 0014): the `mcpServers` registration of `arggon mcp`, the
thirteen `/arggon:<command>` commands rewritten against the arggon **MCP**
surface, the dispatchable subagents below, the bundled `arggon-cli` skill, and
the hook gates (global git gates + the dispatch-scoped reviewer backstop).

Install it once, from this repo's local marketplace — the seam's one manual
step:

```bash
claude plugin marketplace add <repo>/.claude-marketplace
claude plugin install arggon@arggon-local
```

The arggon CLI must be on `PATH` (`npm i -g arggon-manager`, or a linked local
build): `arggon mcp` is the client's whole typed tool surface, and this bundle
ships no second implementation of it.

## The delivery lead is the main session, not a subagent

Claude Code surfaces plugin agents as **dispatchable subagents**; it has no
primary/session-agent concept a plugin can install. The delivery lead is the
opposite position in the role model: the lead is who the product owner
interacts with, the primary worker. Shipping the lead as a plugin agent would
invite the main session to spawn a lead-child with no product-owner channel and
nobody above it to take decision briefs from.

So this seam ships **only the subagent roles** — `arggon-maker` and
`arggon-standards-reviewer` — and **the main session IS the delivery lead**:

- Do not dispatch a "lead": there is no `arggon-delivery-lead` agent here, and
  no surface of this plugin asks you to create one.
- The lead's contract rides the instruction carriers instead of a prompt file:
  the generated repo-root `CLAUDE.md` → `@AGENTS.md` →
  `ArggonManager/docs/agents.md` §Orchestration (wave planning, claim before
  dispatch, one maker per item, lead review, merge verification) and
  `ArggonManager/docs/engineering.md` §Roles and authority (the role table and
  the product-owner boundary).
- Dispatch `arggon:arggon-maker` for item work and
  `arggon:arggon-standards-reviewer` for the read-only review pass (the Agent
  tool's `subagent_type`); everything the lead decides — sequencing, claims, the
  verdict, merge verification and the `done` flip — belongs to the main session
  itself.

## Commands

Claude Code namespaces every component under the plugin name, so the component
name is `<plugin>:<name>`. The plugin's command files are named for the command
alone (`commands/<command>.md`), which is what makes the emitted name
`/arggon:<command>` — the ZCode seam's `/arggon-<command>` spelling would become
the redundant `/arggon:arggon-<command>` here, so the file stems drop the
prefix. The set is the same thirteen commands as the ZCode seam:

| Command            | What it does                                                      |
| ------------------ | ----------------------------------------------------------------- |
| `/arggon:adopt`    | Adopt ArggonManager in this repo as a tracked migration           |
| `/arggon:adr`      | Record a cross-cutting decision as a Proposed ADR                 |
| `/arggon:board`    | Serve the read-only tracker board and share the local URL         |
| `/arggon:done`     | Close a finished item after verifying its gates                   |
| `/arggon:explore`  | Classify the work, then run a spike or the exploration protocol   |
| `/arggon:goal`     | Render the goal-mode contract for one claimed item                |
| `/arggon:handoff`  | Write a structured handoff for an in-flight item                  |
| `/arggon:next`     | Show the next claimable item and how to claim it                  |
| `/arggon:playbook` | Create or refresh a technology playbook with dated research       |
| `/arggon:review`   | Review a maker's changes against the engineering review bar       |
| `/arggon:spec`     | Write a spec (and plan) following the methodology, then verify it |
| `/arggon:start`    | Claim an item and start work in its own git worktree              |
| `/arggon:status`   | Summarize tracker state (progress, blockers, stale claims)        |

Every command drives the arggon **MCP** tools (`mcp__arggon__*`); no command
carries its own copy of a rule or does its own git work.

## One server, one name

The manifest registers exactly one server, keyed `arggon` — the same
`command`/`args` pair (`arggon mcp`) the generated repo-root `.mcp.json`
registers, so a plugin install and a manual registration produce the same
surface. Claude Code loads a plugin's `mcpServers` together with the project
`.mcp.json`, and a later declaration of a name replaces an earlier one; because
both declarations are the same entry under the same key, whichever answers is
the same server over the same tracker. `claude mcp list` shows both surfaces —
`plugin:arggon:arggon` (from this plugin) and the project-scoped `arggon` (from
`.mcp.json`) — and that is why no second server name is ever declared here.

The two names the tools carry follow that split: the plugin-bundled tools
appear as `mcp__plugin_arggon_arggon__<tool>` and the project registration as
`mcp__arggon__<tool>`. Both are the same process; the reviewer backstop below
denies the mutating set under both spellings.

## Hook gates

`hooks/hooks.json` registers one dependency-free Node script
(`hooks/gate.mjs`, invoked in exec form — `node` + the script path as `args`,
no shell, no exec bit) on four events:

- **Every session (`PreToolUse` on `Bash`)** — `git push --force`/`-f` and
  `git commit --no-verify` are denied. The shell gates match the command's
  **words**, not its quoted arguments: a comment payload or commit message that
  merely QUOTES a denied form is documentation and passes, while quoted text a
  shell would still execute (`sh -c "…"`, `eval "…"`, `$( … )`, unterminated
  quotes) stays in the scan.
- **The reviewer dispatch window (`SubagentStart` → `SubagentStop`)** — while
  the standards-reviewer subagent is in flight, `Write`/`Edit` (and the other
  file-writing tools), mutating `arggon` shell invocations, git history commands
  and the mutating `mcp__arggon__*` / `mcp__plugin_arggon_arggon__*` tools are
  denied for that session — `arggon_handoff` included, since a handoff is a
  tracker append like any other mutation. `arggon_comment` stays open: it is the
  verdict channel. Parallel dispatches are counted, so the window holds until
  the last one returns.
- **`Stop`** clears the session's state — the belt-and-braces reset for a
  dispatch that never returned a `SubagentStop`.

The `PreToolUse` matcher selects exactly the tools this gate can decide on:
`Bash`, the file-writing tools, and the arggon MCP tools under **both**
registration prefixes (bare + plugin-scoped) — an unrelated MCP tool never
spawns the gate.

Hooks are **defense-in-depth, and they fail open**: a crashing gate script does
not block the tool call it was watching. The kernel, the pre-commit
`arggon validate` gate and CI remain the enforcement of record. The reviewer id
the gate matches is read out of `agents/arggon-standards-reviewer.md` by
`cli/src/init-claude.test.ts`, so renaming the agent without the gate fails the
suite instead of silently disarming the backstop.

## Port notes (decisions)

This bundle is a bounded port of the ZCode seam (ADR 0014,
spec-claude-code-adapter-024); where the two client surfaces differ, the
decision is:

- **Command file names** drop the ZCode `arggon-` prefix. Claude Code emits
  `<plugin>:<file stem>`, so `commands/<command>.md` in the plugin `arggon`
  runs as `/arggon:<command>`; keeping the prefixed stem would emit the
  redundant `/arggon:arggon-<command>`.
- **`/arggon:goal` renders the contract; the session holds the loop.** ZCode's
  Goal Mode is a client feature with no Claude Code equivalent, so the command
  stops at rendering `arggon goal <item-id>` and names it as the loop's
  objective and verification contract.
- **No goal-mode or automation templates ship here.** The ZCode bundle's
  `templates/goal-mode.md` and the opt-in `templates/automations/**` pair are
  ZCode-specific surfaces and are not vendored into this plugin; the goal
  contract is rendered by the CLI (`arggon goal`), which is seam-independent.
- **Agent files stay `arggon-*.md`.** Unlike a command file, an agent file name
  is the wire id (`arggon:arggon-maker`), and ADR 0021 §6.2a′ forbids forking
  the wire id per client — so the `arggon-` prefix stays.
- **The vendored skill is copied byte-for-byte.** `skills/arggon-cli/**` is the
  agent-agnostic single source (pinned by `cli/src/skill-copy.test.ts` and by
  this bundle's parity test), so the copy inside the plugin still names every
  client's wire ids in its shared role table — including the OpenCode seam's
  selectable `arggon-delivery-lead` session agent. The no-lead rule binds this
  plugin's own dispatch surfaces (commands, agents, manifest, hooks, README),
  not the methodology carrier it vendors.
- **`agents` is deliberately absent from the manifest.** Setting the key
  replaces Claude Code's convention `agents/` scan and surfaced zero agents on
  2.1.289 (probe, this item); omitting it loads the shipped pair. The omission
  is pinned by `cli/src/init-claude.test.ts` so an edit cannot silently disarm
  agent loading.
- **`arggon_handoff` is denied inside the reviewer window; the ZCode gate leaves
  it unlisted.** Spec 024 §Hook gates denies "the mutating `mcp__arggon__*`
  tools" and names `arggon_comment` as the one exception; a handoff appends a
  tracker section, so this seam puts it on the denied side explicitly. The
  ZCode gate's set predates that reading and is unchanged here — a candidate
  follow-up on that seam (recorded on `task-claude-gate-polish`).
