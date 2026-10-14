---
spec_id: claude-code-adapter-024
title: Claude Code adapter (methodology-adapters-017 §S6)
status: proposed
created: 2026-10-11
adr: ArggonManager/docs/adr/0014-zcode-native-seam.md
---

# Spec: Claude Code adapter (claude-code-adapter-024)

Implements [methodology-adapters-017 §S6](spec-methodology-adapters-017.md) (plan T6,
`plan-methodology-adapters-017.md`). Decision record:
[ADR 0014](../adr/0014-zcode-native-seam.md) — a per-agent bundle is a vendored
declarative plugin plus MCP as the typed tool surface, installed through a local
marketplace, with hooks replacing a per-agent permission DSL. Role vocabulary:
[ADR 0021](../adr/0021-agents-primary-workers-human-product-owner.md) §6.1/§6.2a′.
Reference shape this bundle mirrors: the shipped ZCode seam,
[spec-zcode-native-seam-012](spec-zcode-native-seam-012.md) and
`templates/docs/zcode/arggon/`. Implementation story:
[`story-claude-adapter`](../../methodology-productization/native-agent-adapters/story-claude-adapter/story-claude-adapter.md).

## Purpose

§S6 asks for a Claude Code adapter. Its text predates the agent rename and names
an `adapters/claude/` directory; this spec states what ships instead, so the stale
names are not propagated into a second bundle:

- **Vocabulary.** §S6's `coordinator/worker/reviewer` are pre-rename ids. The shipped
  vocabulary is `arggon-delivery-lead` (delivery lead), `arggon-standards-reviewer`
  (practice & standards), `arggon-maker` (maker) and `arggon-verifier` (verifier)
  (ADR 0021 §6.1, renamed by §6.2a′, landed by PR #641). The role table of record is
  `ArggonManager/docs/engineering.md` §Roles and authority.
- **Layout.** `adapters/` holds the committed capability matrix
  (`adapters/capability-matrix.json`), report-only data that `arggon doctor` reads; it
  is not a template source and carries no bundle. The shipped location for a per-agent
  bundle is a template subtree that `arggon init` materializes — the ZCode seam lives
  at `templates/docs/zcode/arggon/` → `.zcode-marketplace/arggon/` via the `DOC_PREFIX_MAP`
  entry in `cli/src/docs.ts`. A Claude bundle therefore lives at
  `templates/docs/claude/**`, not `adapters/claude/**`.

The invariants below are the same ones the ZCode seam and the OpenCode seam are held to;
this spec adds no rule, and the bundle is an **enhancer**, never a requirement.

## Synopsis

```text
templates/docs/claude/                 # the template subtree this spec adds
├── .claude-plugin/marketplace.json    # the marketplace catalog (mirrors zcode/marketplace.json)
└── arggon/                            # the vendored plugin root (mirrors zcode/arggon/)
    ├── .claude-plugin/plugin.json     # manifest: mcpServers, hooks, commands, skills (no `agents` — see the client-facts note)
    ├── skills/arggon-cli/**           # the bundled skill, byte-equal to skills/arggon-cli/**
    ├── commands/<command>.md          # the 13 commands, emitted as /arggon:<command> (the plugin name is the namespace; see the client-facts note)
    ├── agents/arggon-maker.md         # subagent role (convention dir — the manifest omits `agents`)
    ├── agents/arggon-standards-reviewer.md
    ├── hooks/hooks.json               # PreToolUse / SubagentStart / SubagentStop / Stop
    ├── hooks/gate.mjs                 # dependency-free Node gate script (no shell, no exec bit)
    └── README.md                     # the seam doc: install step + the role rule
```

Adopter tree, after `arggon init --agents claude` (or the default selection):

```text
.claude-marketplace/                   # the root the adopter adds as a local marketplace
├── .claude-plugin/marketplace.json
└── arggon/                            # the installed plugin root
CLAUDE.md                              # generated pointer: @AGENTS.md  (already shipped)
.mcp.json                              # generated registration of arggon mcp (already shipped)
```

Client surface facts the bundle is built against (Claude Code, accessed 2026-10-11;
re-probed on claude 2.1.289, 2026-10-14 — the corrections below carry that probe):

- A plugin is a directory whose manifest is `<plugin-root>/.claude-plugin/plugin.json`;
  the manifest declares `mcpServers`, `hooks`, `commands` and `skills`. It does **not**
  declare `agents`: on the probed client (claude 2.1.289) the `agents` key — a single
  path, an array, in-folder or out-of-folder — validates but REPLACES the convention
  `agents/` scan and surfaces zero agents in `claude plugin details`; omitting the key
  loads `agents/*.md` (probe: `Agents (2)`). The shipped manifest therefore omits it,
  and a test pins the omission so an edit cannot silently disarm agent loading. Every
  component path is relative to the plugin root, must start with `./`, and must exist —
  `claude plugin validate` fails a path that is missing or escapes the root.
- A command is a flat `commands/<file>.md` and runs as `/<plugin>:<file>`; a plugin
  agent is `agents/<name>.md` and is dispatched as `<plugin>:<name>`. Components are
  therefore namespaced under the plugin name: the thirteen commands run as
  `/arggon:<command>` (the file stems drop the ZCode seam's `arggon-` prefix, which
  the namespace would repeat), the agents dispatch as `arggon:arggon-maker` /
  `arggon:arggon-standards-reviewer`, and a marketplace entry may add components
  to a plugin manifest only in `strict`'s default mode. A `CLAUDE.md` at the **plugin
  root is not loaded as context**, and the validator warns about it.
- `hooks/hooks.json` holds the plugin's event map wrapped in a top-level `"hooks"` key.
  `PreToolUse`/`PostToolUse` matchers filter on tool name (`Bash`, `Edit|Write`,
  `mcp__<server>__<tool>`); `SubagentStart`/`SubagentStop` matchers filter on **agent
  type**, including a plugin-scoped form such as `^my-plugin:reviewer$`.
- A plugin's `mcpServers` loads **together with** its root `.mcp.json`, and a server
  name declared later replaces an earlier one.
- `${CLAUDE_PLUGIN_ROOT}` resolves in exec-form hook `command`/`args` and in the spawned
  process's environment, so a hook runs `node` + the script path with no shell.
- `claude plugin marketplace add <path>` then `claude plugin install <plugin>@<marketplace>`
  is the platform's install path — the one manual step, mirroring ZCode's.

## Decision-pipeline classification (ADR 0017)

**Classification: bounded. This is a port of the shipped ZCode shape, not greenfield.**

ADR 0017 scopes the six-phase Greenfield Exploration Protocol to "work with no existing
flow to read". Every decision this bundle turns on is already taken:

1. The structure is decided (ADR 0014): a declarative plugin bundle, MCP as the typed
   tool surface, a local-marketplace install as the one manual step, hooks replacing a
   per-agent permission DSL, and a dispatch-scoped reviewer backstop.
2. The role vocabulary and the "which roles a client can express" rule are decided
   (ADR 0021 §6.1/§6.2a′), and `ArggonManager/docs/agents.md` §ZCode states the rule
   extends to S6 explicitly: plugin agents are subagents, and the lead role belongs in
   instruction material.
3. The invariant-for-invariant contract to mirror exists
   ([spec-zcode-native-seam-012](spec-zcode-native-seam-012.md)), as does the headless
   evidence shape it is gated by (`cli/src/init-zcode.test.ts`).
4. The client surface is documented, shipped and versioned (the plugin manifest
   reference and the hooks reference, cited above), so the residual unknowns are three
   named questions in [Open questions](#open-questions) rather than an unknown shape.

So **no exploration artifact is owed for this wave**, and the implementation wave may
claim its tasks as soon as this spec passes `arggon spec analyze`. The ADR 0017
classification is a one-way ratchet, so if the wave hits a shape that contradicts one
of the four points above — a plugin format that cannot carry a component the seam
needs, or a marketplace that refuses a repo-local root — it stops, files the
exploration, and leaves its implementation tasks unclaimed until that lands. No
implementation task is claimed before that resolution.

## Invariants

- **One logic path.** Every mutation the Claude bundle makes of tracker state goes
  through `arggon mcp` → the kernel (`lib/`), or through the CLI. No bundle file keeps
  a copy of a rule; the `commands/` templates drive `mcp__arggon__*` calls, never their
  own git work.
- **Same rules for humans and agents.** The bundle enforces nothing the kernel does
  not already enforce: no steal, no reopen, claim-before-done.
- **Parity with the kernel.** The Claude client's whole typed tool surface is the
  fifteen `arggon mcp` tools with their documented `--json` envelopes — the same set
  the ZCode plugin and the OpenCode seam use. There is exactly one surface.
- **Generated with provenance, never overwrites.** Every generated bundle file is
  recorded in the tracker's `x-generated` block; an adopter-edited file is skipped and
  reported, never clobbered, on the same terms as every other generated seam file.
- **One server, one name.** The bundle registers `arggon` and nothing else. The
  generated `.mcp.json` and the plugin manifest must not produce two differently-named
  servers over one tracker, and must not let resolution order decide which one answers.
- **No shell assembly.** Hook handlers run in exec form (`command` + `args`) so path
  placeholders are substituted as plain arguments; the gate script parses stdin JSON and
  exits, and no user-controlled string is concatenated into a shell line.
- **Hooks fail open, documented.** A hook error or a crashing gate script does not block
  the tool call. Client hooks are defense-in-depth; the kernel stays the enforcement of
  record, and the capability matrix says so per row.
- **Adapters are enhancers.** `docs/` plus the CLI remain a complete methodology. An
  absent bundle, a skipped marketplace install, an adopter who runs `--no-agents`, or a
  missing `arggon` on `PATH` degrades the tree to that floor and never bricks it.

## Roles a Claude Code tree can express

The bundle materializes **two** subagent roles, both under the shipped ids:

| File                                  | Dispatched agent                   | Role                 |
| ------------------------------------- | ---------------------------------- | -------------------- |
| `agents/arggon-maker.md`              | `arggon:arggon-maker`              | maker                |
| `agents/arggon-standards-reviewer.md` | `arggon:arggon-standards-reviewer` | practice & standards |

- **The delivery lead is not a plugin agent.** Claude Code surfaces plugin agents as
  dispatchable subagents; it has no primary/session-agent concept a plugin can install.
  The lead is the opposite position in the role model — the primary worker the product
  owner interacts with — so shipping it as a plugin agent would invite a lead-child
  with no product-owner channel and nobody above it. The lead's contract rides the
  generated repo-root `CLAUDE.md` → `@AGENTS.md` → `ArggonManager/docs/agents.md`
  §Orchestration and `ArggonManager/docs/engineering.md` §Roles and authority, plus the
  bundle's `README.md`, which states that no surface of this plugin dispatches a lead.
  This is the rule `agents.md` §ZCode already states for S6.
- **The lead's contract must not ride a `CLAUDE.md` inside the plugin.** A `CLAUDE.md`
  at the plugin root is not loaded as context and the validator warns about it. The
  bundle therefore ships the lead's contract in `README.md` and the skill, and the path
  that actually loads is the generated `CLAUDE.md` at the adopter's repo root.
- **`arggon-verifier` is deliberately not materialized.** The verifier runs the
  project's verification gates and reports expected-versus-observed, which needs shell
  without writes; the shipped precedent is that a subagent-only seam ships no verifier
  (the ZCode seam ships none either, and `agents.md` §Orchestration records that there
  the delivery lead or the maker runs the probes). On the Claude seam the split is
  structural for the same reason. The omission is a client-capability statement, not a
  role change, and it is declared rather than silent.
- **Adopter-edited copies are kept.** An existing `.claude/agents/arggon-maker.md` a
  repo already owns is adopter-owned; the bundle never removes it.

## The honest starting floor

The starting floor is what `arggon init` already gives a Claude Code tree **with no
bundle at all**, which is exactly what `adapters/capability-matrix.json` records for the
`claude` row:

- the generated `CLAUDE.md` → `@AGENTS.md` pointer, which loads the playbook
  (`ArggonManager/docs/agents.md`, `ArggonManager/docs/engineering.md`); and
- the generated `.mcp.json`, which registers `arggon mcp` project-scoped and hands this
  client the same fifteen tools and envelopes as every other seam.

On that floor the matrix carries three non-gap rows (`same-rules`, `state-in-git`,
`claim-integrity`) and two gap rows: nothing inside the client enforces
`discipline-enforceable`, and nothing injects the active work item for
`docs-travel-with-code` — the agent fetches it with `arggon_show`. This spec does not
claim this bundle is a prerequisite; it is an optional layer over a working floor.

What the bundle is expected to move, and nothing more:

| Matrix row                                      | Today                          | After the bundle                                                                                                                              |
| ----------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `discipline-enforceable`                        | gap — kernel + pre-commit + CI | `claude:plugin.hooks.PreToolUse` (the gate below) — the matrix still records the kernel as the enforcement of record, because hooks fail open |
| `docs-travel-with-code`                         | gap — nothing injects the item | still a gap: a plugin has no session-context hook. The commands carry the playbook and the agent fetches the item with `arggon show`          |
| `same-rules`, `state-in-git`, `claim-integrity` | delivered                      | unchanged, now also from the plugin's `mcpServers` under the same one-server rule                                                             |

`adapters/capability-matrix.json` is owned by another lane; this spec reads it and
reflects it, and the implementation wave reports the row deltas it observes rather than
editing the matrix by hand.

## Hook gates (the §S6 "gate equivalent")

One dependency-free Node script (`hooks/gate.mjs`), invoked in exec form
(`"command": "node"`, `"args": ["${CLAUDE_PLUGIN_ROOT}/hooks/gate.mjs"]`) — no exec bit,
no shell, the same shape as the ZCode gate. Two gates, both defensive only:

- **Global, every session (deny).** `git push --force` / `-f` and `git commit
--no-verify`. Matched on `PreToolUse` with a `Bash` matcher; the payload is JSON on
  stdin, and the decision is returned as `hookSpecificOutput.permissionDecision:
"deny"` with a `permissionDecisionReason`, or as exit code 2.
- **Reviewer dispatch window (deny writes).** While the standards-reviewer subagent is
  in flight, `Write`/`Edit`, mutating `arggon` shell invocations, git history commands
  and the mutating `mcp__arggon__*` tools are denied for that session; `arggon_comment`
  stays open as the verdict channel. Claude Code's dedicated `SubagentStart` /
  `SubagentStop` events carry the agent type in their matcher, which is the native
  equivalent of the ZCode marker pair — the window opens on
  `^arggon:arggon-standards-reviewer$` and closes on `SubagentStop`, with `Stop`
  clearing any residue and parallel dispatches counted.
- **The matcher is bound to the shipped id by a test.** The reviewer id is read out of
  the shipped `agents/arggon-standards-reviewer.md` and the hook's matcher is asserted
  to match the namespaced form of it. Renaming the agent without the gate must fail the
  suite, not silently disarm the backstop — the same coupling ADR 0021 §6.2a′ names for
  the ZCode gate.

Namespacing is the sharp edge here: the plugin name prefixes every component, so the
agent file name must stay the shipped wire id (`arggon-maker`, not `maker`), and the
matcher must be prefix-tolerant (`/(^|:)arggon-standards-reviewer$/`) the way the ZCode
gate's `/(^|:)arggon-reviewer$/` already is. Naming the file `maker.md` would fork the
wire id per client, which ADR 0021 §6.2a′ forbids.

## MCP wiring

- The plugin manifest registers one server:
  `"mcpServers": { "arggon": { "command": "arggon", "args": ["mcp"] } }` — the same
  entry the generated `.mcp.json` already carries, so a plugin install and a manual
  registration produce the same surface.
- Claude Code loads a plugin's `mcpServers` together with the plugin root's `.mcp.json`
  and a later declaration of a name replaces an earlier one. The bundle must therefore
  declare **exactly one key, `arggon`**. A second key (`arggon-mcp`, `arggon-mcp-plugin`)
  would give a Claude session two independent servers over one tracker.
- Plugin-bundled MCP tools are exposed under a scoped name
  (`mcp__plugin_<plugin>_<server>__<tool>`), so the reviewer window's deny matcher must
  match the scoped form, not the bare `mcp__arggon__*` name. A test pins the scoped
  prefix the gate matches.
- `arggon` must be on `PATH` (npm `i -g arggon-manager`, or a linked local build). It
  is the client's whole typed tool surface — the same dependency the ZCode seam already
  documents.

## Marketplace and the one manual install step

`templates/docs/claude/.claude-plugin/marketplace.json` mirrors the shape of
`templates/docs/zcode/marketplace.json`: a catalog whose single entry names the plugin,
its local `source` (`./arggon`), a version, a description and a display name. The
adopter's manual step is the two documented commands:

```bash
claude plugin marketplace add <repo>/.claude-marketplace
claude plugin install arggon@arggon-local
```

`arggon init` writes no Claude settings stanza, mirroring ADR 0014's carry-over of
ADR 0011 §5: an adopter who skips the install keeps the `.mcp.json` floor. The bundle's
`README.md` names the step, the `PATH` requirement and the role rule.

## Headless smoke parity bar

The bar is the ZCode seam's owned bar, applied to this bundle, runnable in CI with no
Claude Code binary present. Evidence lands in `cli/src/init-claude.test.ts`, mirroring
`cli/src/init-zcode.test.ts`:

- **Fresh-init seam shape.** `arggon init` (default selection, and explicitly
  `--agents claude`) materializes the marketplace root and the plugin root at the
  declared destinations, and nothing else. Every component path `plugin.json` declares
  exists and resolves inside the plugin root — both of Claude Code's own load failures
  (`path not found`, `path escapes plugin directory`) are asserted absent.
- **Manifest / marketplace consistency.** The marketplace entry's `name`, `source`,
  `version` and `description` match `plugin.json`'s, and the entry declares no component
  that conflicts with the manifest's `strict` mode.
- **Provenance.** Every generated destination is recorded in the tracker's
  `x-generated` block; JSON destinations carry no visible marker (an HTML comment is
  invalid JSON) and the boundary is covered by the existing `isJsonDestination` check,
  not by a new one.
- **Never overwrites.** An adopter-edited bundle file is skipped and reported
  `skipped`, never clobbered, and re-init reports the same decision table.
- **Gate script contract.** Global deny for force-push and `--no-verify`; the reviewer
  window opens on the reviewer `SubagentStart`, denies writes, and closes on
  `SubagentStop`, with parallel dispatches counted and `Stop` clearing residue;
  ordinary sessions are unimpaired; a denied form quoted as inert documentation passes
  while a denied form that executes is still denied.
- **MCP registration.** `plugin.json`'s `mcpServers.arggon` equals the generated
  `.mcp.json` entry on `command` and `args`; the bundle declares no other server name.
- **Live-server probe.** The bundle's declared entry is spawned as a real process
  (`arggon mcp`, stdio, JSON-RPC 2.0 newline-delimited) against a fixture tracker root,
  and one round-trip (`arggon_show`) returns the documented envelope. This is the proof
  that the registration Claude Code would perform points at a live, kernel-backed server
  — not merely that a JSON field is well-formed.
- **Roles.** The generated tree contains exactly two plugin agents,
  `arggon-maker` and `arggon-standards-reviewer`; no file in the bundle names a lead
  agent; every lead reference resolves to the generated `CLAUDE.md`/`AGENTS.md`
  carriers.
- **No silent disarm.** The reviewer-dispatch command file dispatches the id the gate
  matcher matches, read out of the shipped agent file.
- **Skill parity.** The bundle's `skills/arggon-cli/**` is byte-equal to
  `skills/arggon-cli/**` modulo the generated marker — one skill, two destinations,
  never two copies.
- **Doctor.** `arggon doctor --agents` reports the bundle's files as
  `present`/`stale`/`adopter-edited`/`missing` and the claude gap rows, and the gap-row
  set shrinks by no row the bundle does not actually close.
- **Optional, skipped when absent.** On a throwaway HOME, `claude plugin validate
./.claude-marketplace/arggon` reports `Validation passed`, and
  `claude plugin marketplace add` + `claude plugin install` installs the plugin. When
  the `claude` binary is not on `PATH` these steps are recorded as
  `skipped: claude not installed`, the same shape as the OpenCode smoke's
  `skipped: opencode not installed`; a recorded skip is reported as a skip, never as a
  pass.

## Failure and error paths

| Condition                                                                 | What the client sees                                                                        | What the seam does                                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `arggon` not on `PATH`                                                    | The MCP server fails to start; the session continues with no arggon tools                   | Nothing assumes the server is up. The gate is dependency-free and never calls MCP. `README.md` names the requirement.   |
| Hook script crashes or exits non-zero                                     | The tool call continues (`onFailure` defaults to `continue`)                                | Recorded as fail-open. The kernel, the pre-commit `arggon validate` gate and CI remain the enforcement of record.       |
| `plugin.json` names a missing path or a path with `..`                    | Claude Code refuses to load the plugin (`path not found` / `path escapes plugin directory`) | `init` must never emit a manifest naming a path it did not write; the smoke asserts every declared path exists in-root. |
| Adopter skips the marketplace install                                     | No plugin, and the `.mcp.json` floor remains                                                | No surface claims the bundle is installed. `doctor --agents` reports `missing` and the gap rows stay.                   |
| Two servers declare the name `arggon`                                     | The later declaration replaces the earlier one; no second server exists                     | The bundle declares exactly one key, so resolution order cannot pick the answer.                                        |
| `arggon init --agents opencode,zcode` (or `--no-agents`) on a Claude tree | The bundle is simply not generated; nothing on disk is removed                              | Selection never deletes and never overwrites; the tree stays on the generated `CLAUDE.md` + `.mcp.json` floor.          |

## Impact class

This spec is a product doc under `ArggonManager/docs/specs/`, not a methodology carrier,
so this wave states no impact class. The **implementation wave** touches
`ArggonManager/docs/agents.md` (a new Claude Code seam section beside §ZCode) and the
bundled skill, so it is **Behavioral** per `ArggonManager/docs/agents.md` §Changing the
methodology itself: agents must re-learn a new client surface. That PR must state the
class, keep `skills/arggon-cli/**` and its copies byte-equal, and update every doc
statement the new seam makes false — including the capability-matrix rows and the
`agents.md` §ZCode sentence that currently says the rule applies to S6.

## Acceptance

Implementation contract for `story-claude-adapter`. Each box is checkable; the headless
bar is in [Headless smoke parity bar](#headless-smoke-parity-bar).

- [ ] `templates/docs/claude/**` exists with the manifest, marketplace catalog, the two
      agent files, the command set, the hooks pair and the seam `README.md`; nothing is
      written under `adapters/**`
- [ ] `arggon init` materializes `.claude-marketplace/**` with provenance, never
      overwrites an adopter-edited file, and `--json` reports per-file
      `written`/`skipped` with honest counts
- [ ] `arggon init --agents opencode,zcode` and `--no-agents` do not generate the
      bundle; an unknown agent name is still refused by name with nothing written
- [ ] The generated tree contains exactly the agents `arggon-maker` and
      `arggon-standards-reviewer`; no file names a lead agent, and every lead reference
      resolves to the generated `CLAUDE.md`/`AGENTS.md` carriers
- [ ] The bundle registers exactly one MCP server, keyed `arggon`, byte-equal in
      `command`/`args` to the generated `.mcp.json` entry; a live stdio round-trip
      against a fixture tracker returns the documented envelope
- [ ] The gate denies force-push and `--no-verify` for every session, denies writes for
      the reviewer window opened by the reviewer's `SubagentStart` and closed by
      `SubagentStop`, counts parallel dispatches, clears on `Stop`, matches the scoped
      plugin MCP tool prefix, and leaves ordinary sessions unimpaired
- [ ] The gate's reviewer matcher is bound to the id read out of the shipped
      `agents/arggon-standards-reviewer.md`, and the review command dispatches that
      same id — the backstop cannot be disarmed by a rename
- [ ] `skills/arggon-cli/**` in the bundle is byte-equal to `skills/arggon-cli/**`
      modulo the generated marker (one skill, two destinations)
- [ ] `cli/src/init-claude.test.ts` covers every box above and passes in CI with the
      `claude` binary absent; the binary-present probes are recorded as
      `skipped: claude not installed` rather than dropped or counted as passes
- [ ] `arggon doctor --agents` reports the bundle files with the documented status set
      and the claude gap rows, and no gap row is reported as closed that the bundle
      does not close
- [ ] `ArggonManager/docs/agents.md` gains a Claude Code seam section beside §ZCode that
      names the marketplace install step, the one-server rule, the two-agent rule and
      the namespaced component names, with impact class stated as **Behavioral**
- [ ] `arggon validate`, the full test suite, lint, and `arggon spec analyze` are green,
      with no new `spec analyze` finding naming this item

## Non-goals

- No Claude-specific kernel rule, no second logic path, and no change to
  `arggon mcp`'s tool set or envelopes.
- No generation of `.claude/settings.json` or any Claude settings stanza — project
  settings are the adopter's.
- No marketplace hosted on claude.ai, and no Anthropic directory submission.
- No `arggon-verifier` plugin agent (see [Roles](#roles-a-claude-code-tree-can-express)).
- No second copy of the `arggon-cli` skill.
- No blocking CI gate on adapter freshness (report-only first, per ADR 0016's spirit).
- No Cursor/Codex/Gemini adapter; those stay matrix `gap` rows.

## Open questions

Three named questions for the implementation wave, each resolved by a recorded probe
rather than an assumption. None blocks claiming this spec's tasks; any one that fails
its probe triggers the ADR 0017 ratchet.

1. Does `claude plugin marketplace add <path>` accept a repo-local directory whose
   manifest is `<path>/.claude-plugin/marketplace.json` — i.e. is `.claude-marketplace/`
   (the mirror of `.zcode-marketplace/`) a loadable marketplace root, or does the
   platform require the manifest at the repo root?
2. Under the plugin namespace, what is the dispatched name of a flat
   `commands/arggon-next.md` file in the plugin `arggon`? The manifest reference states
   components are namespaced under the plugin name; the smoke pins the emitted form
   wherever that rule puts it, and the bundle's `README.md` must not name a command the
   client cannot run.
3. Does carrying the key `arggon` in both the plugin's `mcpServers` and the generated
   `.mcp.json` pass `claude plugin validate`, given the replace-on-name rule? If it does
   not, the bundle's manifest drops the key and the generated `.mcp.json` stays the one
   registration — one server either way, decided by the probe rather than by taste.
