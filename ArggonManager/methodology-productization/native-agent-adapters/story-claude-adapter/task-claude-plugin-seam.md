---
type: task
status: in_progress
id: task-claude-plugin-seam
title: "Claude Code adapter: the plugin bundle, init seam and hook gate with the headless bar (spec S6/024)"
assignee: arggon-delivery-lead
branch: feat/task-claude-plugin-seam
parent: story-claude-adapter
labels: []
created: "2026-10-14"
updated: "2026-10-14"
claimed_at: "2026-10-14T18:23:36.047Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-claude-plugin-seam
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-claude-adapter/task-claude-plugin-seam.md
  Leaves live only under a story. id is the filename stem: task-claude-plugin-seam.
  CLI `arggon create task claude-plugin-seam` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Claude Code adapter: the plugin bundle, init seam and hook gate with the headless bar (spec S6/024)

## Context

The implementation wave for [story-claude-adapter](story-claude-adapter.md) per
[spec-claude-code-adapter-024](../../../docs/specs/spec-claude-code-adapter-024.md): a
**bounded port of the shipped ZCode seam** (ADR 0014) into a Claude Code plugin bundle,
carrying the post-rename vocabulary (ADR 0021 §6.1/§6.2a′). This task owns everything
material — `templates/docs/claude/**`, the init/selection wiring, the hook gate, the
headless bar (`cli/src/init-claude.test.ts`) and the existing-suite updates the new seam
forces. The sibling task `task-claude-matrix-and-docs` (depends on this one) owns the
capability-matrix data, the `agents.md` seam section and the spec's open-question
resolution.

The delivery lead ran the probes this bundle's shape turns on (claude 2.1.289 on this
machine, throwaway HOME; transcripts in the item comments / PR body):

- **Q1 PASS — a repo-local marketplace root loads.**
  `.claude-marketplace/.claude-plugin/marketplace.json` + `claude plugin marketplace add <path>`
  → "Successfully added marketplace: arggon-local"; `claude plugin install arggon@arggon-local`
  → installed (user scope). The spec synopsis layout stands.
- **Manifest shape (new finding).** Setting `agents` in `plugin.json` (single path, array,
  in-folder or out-of-folder) validates but **surfaces 0 agents** in `claude plugin details`
  on 2.1.289 — the key replaces the default `agents/` scan and loads nothing. Omitting the
  key loads the convention `agents/` directory (probe: `Agents (2) arggon-standards-reviewer,
arggon-maker`). So the bundle manifest **omits `agents`** and ships the agent files in the
  convention dir; a test pins the omission so a future edit cannot silently disarm agent
  loading. Spec 024's client-facts line that says the manifest "declares … agents" is
  corrected by this task, probe recorded.
- **Q2 — namespacing.** Components are namespaced under the plugin name: commands run as
  `/arggon:<command>` (manifest reference: `"about"` in `deploy-tools` → `/deploy-tools:about`),
  agents dispatch as `arggon:arggon-maker` / `arggon:arggon-standards-reviewer`, plugin MCP
  tools surface as `mcp__plugin_arggon_arggon__<tool>` while the floor `.mcp.json` keeps
  `mcp__arggon__<tool>`. `claude plugin details` shows the inventory (commands surface under
  "Skills" in 2.1.x; hooks as the four events).
- **Q3 PASS — both registrations validate.** Carrying the `arggon` key in the manifest
  `mcpServers` AND the generated repo-root `.mcp.json` passes `claude plugin validate`
  (inline key kept). At runtime `claude mcp list` shows both surfaces —
  `plugin:arggon:arggon` (connected) and the project `arggon` (approval pending) — so the
  gate's mutation deny must cover both prefixes.
- **Hooks.** Handler shape
  `{"type":"command","command":"node","args":["${CLAUDE_PLUGIN_ROOT}/hooks/gate.mjs", …]}`
  is the warning-free exec form; `author` in the manifest + `description` in the marketplace
  silence the remaining validate warnings. `SubagentStart`/`SubagentStop` match on agent type
  (`^arggon:arggon-standards-reviewer$`) and carry `agent_id` + `agent_type`; `Stop` clears.

## Acceptance

- [ ] `templates/docs/claude/**` exists: `.claude-plugin/marketplace.json`, `arggon/.claude-plugin/plugin.json`, the two agent files, the command set, `hooks/hooks.json` + `hooks/gate.mjs`, the seam `README.md`, the bundled `skills/arggon-cli/**` copy; nothing is written under `adapters/**`
- [ ] `plugin.json` omits `agents` (probe-pinned, test comment names the 2.1.289 finding), declares `commands`/`skills`/`hooks`/`mcpServers` (+ `author`), and `marketplace.json` mirrors the ZCode catalog shape for plugin `arggon` / marketplace `arggon-local` (with `description`)
- [ ] `cli/src/docs.ts`: `claude/` → `.claude-marketplace/` prefix mapping + `.claude-marketplace/**/*.md` frontmatter marker; `cli/src/adapters.ts`: claude classification extended to `docs/claude/` (the `docs/CLAUDE.md` + `docs/mcp-json` floor matches kept) and the `.claude-marketplace` detection marker added
- [ ] `arggon init` materializes `.claude-marketplace/**` with provenance and honest `--json` `written`/`skipped` counts; `--agents opencode,zcode` and `--no-agents` generate no claude file; an unknown agent name is still refused by name with nothing written
- [ ] The generated tree contains exactly `arggon-maker` and `arggon-standards-reviewer` agent files; no bundle file names a lead agent; every lead reference resolves to the generated `CLAUDE.md`/`AGENTS.md` carriers
- [ ] Exactly one MCP server keyed `arggon`, byte-equal in `command`/`args` to the generated `.mcp.json` entry; the live stdio round-trip test spawns `arggon mcp` against a fixture tracker and returns the documented `arggon_show` envelope
- [ ] The gate denies force-push + `--no-verify` for every session; denies `Write`/`Edit`, mutating `arggon` shell and mutating MCP tools for the reviewer window opened by `SubagentStart` and closed by `SubagentStop`; counts parallel dispatches; `Stop` clears; ordinary sessions unimpaired; the quoted-text semantics port the ZCode gate's (inert text exempt, executed text denied)
- [ ] The gate's reviewer matcher is bound to the id read out of the shipped `agents/arggon-standards-reviewer.md`, the review command dispatches that same id, and the deny set covers the scoped `mcp__plugin_arggon_arggon__arggon_*` **and** bare `mcp__arggon__arggon_*` prefixes (a test pins both)
- [ ] `skills/arggon-cli/**` in the bundle is byte-equal to `skills/arggon-cli/**` modulo the generated marker, with the sync mechanism decided and recorded (one skill, two destinations)
- [ ] `cli/src/init-claude.test.ts` covers every box here and passes in CI with the `claude` binary absent (present-probes recorded as `skipped: claude not installed`, never as passes); any claude-invoking test uses a throwaway HOME/`CLAUDE_CONFIG_DIR`
- [ ] Existing suites updated: `init.test.ts` (TIER1 set), `adapter-selection.test.ts`, `adopter-template-invariant-drift.test.ts` (claude member), `mcp-doc-contract.test.ts` (corpus), `pack-contents.test.ts` if needed
- [ ] Repo-self: this repo's own `.claude-marketplace/**` is materialized and committed the way `.zcode-marketplace/**` is (scoped `--agents claude` init; `x-generated` rows recorded) — or the reason it is not is recorded
- [ ] Probes re-run and recorded on the item (`marketplace add`/`install`, `claude plugin validate`, `claude plugin details` Agents(2), `claude mcp list`), and spec 024's contradicted client-facts line corrected
- [ ] `arggon validate`, full `npm test`, lint, structure, prettier green

## Notes

- Read first: `templates/docs/zcode/arggon/**`, `templates/docs/zcode/marketplace.json`,
  `cli/src/init-zcode.test.ts` (the bar to mirror), `cli/src/docs.ts` (DOC_PREFIX_MAP,
  `isFrontmatterDestination`, provenance/decision engine), `cli/src/adapters.ts`.
- Command set = the ZCode seam's 13 `/arggon-*` commands (adopt, adr, board, done, explore,
  goal, handoff, next, playbook, review, spec, start, status), re-pointed at `mcp__arggon__*`
  and named `/arggon:<command>` in the README. Any command that cannot port as-is (e.g. one
  referencing a ZCode bundle template the Claude bundle does not ship) is resolved and the
  decision recorded.
- Scope boundary: no verifier plugin agent, no settings stanza, no second skill copy, no
  network/directory submission; hooks stay fail-open per spec.
- The sibling task owns matrix/docs/spec-status; do not flip spec 024's `status` here — only
  correct facts this task contradicts.
