---
type: task
status: done
id: task-claude-plugin-seam
title: "Claude Code adapter: the plugin bundle, init seam and hook gate with the headless bar (spec S6/024)"
assignee: arggon-delivery-lead
branch: feat/task-claude-plugin-seam
parent: story-claude-adapter
labels: []
created: "2026-10-14"
updated: "2026-10-14"
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

- [x] `templates/docs/claude/**` exists: `.claude-plugin/marketplace.json`, `arggon/.claude-plugin/plugin.json`, the two agent files, the command set, `hooks/hooks.json` + `hooks/gate.mjs`, the seam `README.md`, the bundled `skills/arggon-cli/**` copy; nothing is written under `adapters/**`
- [x] `plugin.json` omits `agents` (probe-pinned, test comment names the 2.1.289 finding), declares `commands`/`skills`/`hooks`/`mcpServers` (+ `author`), and `marketplace.json` mirrors the ZCode catalog shape for plugin `arggon` / marketplace `arggon-local` (with `description`)
- [x] `cli/src/docs.ts`: `claude/` → `.claude-marketplace/` prefix mapping + `.claude-marketplace/**/*.md` frontmatter marker; `cli/src/adapters.ts`: claude classification extended to `docs/claude/` (the `docs/CLAUDE.md` + `docs/mcp-json` floor matches kept) and the `.claude-marketplace` detection marker added
- [x] `arggon init` materializes `.claude-marketplace/**` with provenance and honest `--json` `written`/`skipped` counts; `--agents opencode,zcode` and `--no-agents` generate no claude file; an unknown agent name is still refused by name with nothing written
- [x] The generated tree contains exactly `arggon-maker` and `arggon-standards-reviewer` agent files; no bundle file names a lead agent; every lead reference resolves to the generated `CLAUDE.md`/`AGENTS.md` carriers
- [x] Exactly one MCP server keyed `arggon`, byte-equal in `command`/`args` to the generated `.mcp.json` entry; the live stdio round-trip test spawns `arggon mcp` against a fixture tracker and returns the documented `arggon_show` envelope
- [x] The gate denies force-push + `--no-verify` for every session; denies `Write`/`Edit`, mutating `arggon` shell and mutating MCP tools for the reviewer window opened by `SubagentStart` and closed by `SubagentStop`; counts parallel dispatches; `Stop` clears; ordinary sessions unimpaired; the quoted-text semantics port the ZCode gate's (inert text exempt, executed text denied)
- [x] The gate's reviewer matcher is bound to the id read out of the shipped `agents/arggon-standards-reviewer.md`, the review command dispatches that same id, and the deny set covers the scoped `mcp__plugin_arggon_arggon__arggon_*` **and** bare `mcp__arggon__arggon_*` prefixes (a test pins both)
- [x] `skills/arggon-cli/**` in the bundle is byte-equal to `skills/arggon-cli/**` modulo the generated marker, with the sync mechanism decided and recorded (one skill, two destinations)
- [x] `cli/src/init-claude.test.ts` covers every box here and passes in CI with the `claude` binary absent (present-probes recorded as `skipped: claude not installed`, never as passes); any claude-invoking test uses a throwaway HOME/`CLAUDE_CONFIG_DIR`
- [x] Existing suites updated: `init.test.ts` (TIER1 set), `adapter-selection.test.ts`, `adopter-template-invariant-drift.test.ts` (claude member), `mcp-doc-contract.test.ts` (corpus), `pack-contents.test.ts` if needed
- [x] Repo-self: this repo's own `.claude-marketplace/**` is materialized and committed the way `.zcode-marketplace/**` is (scoped `--agents claude` init; `x-generated` rows recorded) — or the reason it is not is recorded
- [x] Probes re-run and recorded on the item (`marketplace add`/`install`, `claude plugin validate`, `claude plugin details` Agents(2), `claude mcp list`), and spec 024's contradicted client-facts line corrected
- [x] `arggon validate`, full `npm test`, lint, structure, prettier green

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

### 2026-10-14 @Arggon

Evidence — maker pass (task-claude-plugin-seam, spec-claude-code-adapter-024)

Branch `feat/task-claude-plugin-seam`, worktree
`/home/arggon/Projects/ArggonManager-task-claude-plugin-seam`. PR: #821 (open against main).

## What shipped (acceptance box by box)

- **`templates/docs/claude/**`** — `.claude-plugin/marketplace.json` (marketplace
  `arggon-local`, entry `arggon`), `arggon/.claude-plugin/plugin.json`,
  `arggon/agents/arggon-maker.md` + `arggon-standards-reviewer.md`,
  `arggon/commands/<command>.md` (13), `arggon/hooks/hooks.json` +
  `arggon/hooks/gate.mjs`, `arggon/README.md`, `arggon/skills/arggon-cli/**` (7
  files). Nothing under `adapters/**`.
- **Manifest** omits `agents` (2.1.289 finding, pinned by test); declares
  `author`, `license`, `commands`/`skills`/`hooks` (path strings) and one inline
  `mcpServers.arggon`; the marketplace carries a top-level `description` (the
  validator warns without it — probe) plus the entry `description`/`displayName`.
- **init wiring** — `cli/src/docs.ts` `claude/` → `.claude-marketplace/` prefix
  map + `.claude-marketplace/**/*.md` frontmatter marker; `cli/src/adapters.ts`
  `docs/claude/` classification + `.claude-marketplace` detection marker.
- **Selection** — `--agents claude` (and the default) materializes the bundle;
  `--agents opencode,zcode` / `--no-agents` write no claude file; an unknown name
  is still refused by name with nothing written (tests + repo-self dry run).
- **Roles** — exactly `arggon-maker` + `arggon-standards-reviewer`; the lead is
  the main session (README states it; the id appears only in the README's
  prohibition, and the vendored skill's shared role table is exempted with its
  reason recorded).
- **One MCP server** keyed `arggon`, byte-equal to the generated `.mcp.json`
  entry; live stdio round-trip (`arggon_show`) returns the documented envelope.
- **Gate** — global force-push/`--no-verify` denies with the ported quoted-text
  semantics (inert text exempt, executed text denied, variable-indirection
  residual recorded); reviewer window on `SubagentStart` `^arggon:arggon-standards-reviewer$`,
  closed by `SubagentStop`, parallel dispatches counted, `Stop` clears; denies
  the mutating arggon tools under BOTH `mcp__arggon__` and
  `mcp__plugin_arggon_arggon__` prefixes (and keeps `arggon_comment` open under
  both); ordinary sessions unimpaired; fail-open on a bad payload.
- **Matcher binding** — the reviewer id is read out of the shipped agent file by
  the test and asserted against the gate's regex, the hooks.json
  SubagentStart/SubagentStop matchers AND the review command's dispatch string.
- **Skill parity** — `skills/arggon-cli/**` stays the single committed source;
  `npm run skills:sync` writes the marker-less staging copy under
  `templates/docs/claude/arggon/skills/arggon-cli/**`; the tests pin
  staging == source and generated == marker + source, and the file set.
- **Existing suites** — `init.test.ts` (TIER1 set), `adapter-selection.test.ts`
  (claude classification, the new detection marker, cap/snapshot),
  `adopter-template-invariant-drift.test.ts` (claude member + subtree),
  `mcp-doc-contract.test.ts` (corpus dir).
- **Repo self** — `.claude-marketplace/**` (26 files) materialized with
  `arggon init . --agents claude --no-commit` and committed like
  `.zcode-marketplace/**`; 26 `x-generated` rows in `ArggonManager/.convention.yml`
  (plus the refreshed skills row). A dry run confirmed nothing else churns (all
  other seams `agent-not-selected`); a test now keeps the committed copy in step
  with the templates.
- **Spec 024** — the client-facts bullet that said the manifest "declares …
  agents" is corrected to the probed reality (probe recorded in the text) and the
  synopsis now matches the shipped command file/event names. Open questions and
  `status: proposed` untouched (sibling task).

## Gates (worktree, branch `feat/task-claude-plugin-seam`)

- `npm run arggon -- validate` → `{"ok":true, errors:[], warnings:[]}`
- `npm test` → 158 files / 3457 tests passed, 0 failed
- `npm run lint` → green
- `npm run test:structure` → 5 rules, 5 passed; fixture scan clean
- `npm run check:plugin` → green (bundle byte-identical, nothing to commit)
- `npx prettier --check` on every touched/added file → all clean; the generated
  `.claude-marketplace` copies inherit the pre-existing marker-stamp formatting
  class (same as `.zcode-marketplace/arggon/README.md` and `CLAUDE.md` on main)
- `npm run arggon -- spec validate` → ok; `spec analyze` → 4 pre-existing
  findings, none naming spec-024
- CI-without-claude shape verified locally: `PATH` without the binary →
  `23 passed | 1 skipped`, and the log records `skipped: claude not installed`

## Probes (claude 2.1.289, throwaway HOME + CLAUDE_CONFIG_DIR; full transcripts in the PR body)

- `claude plugin validate --strict` on the template plugin root and the
  marketplace root, and on the generated tree → `Validation passed`
- `claude plugin marketplace add <generated .claude-marketplace>` →
  `Successfully added marketplace: arggon-local`; `claude plugin install
arggon@arggon-local` → `Successfully installed plugin (scope: user)`
- `claude plugin details arggon` → `Agents (2) arggon-standards-reviewer,
arggon-maker`, `Hooks (4) PreToolUse, SubagentStart, SubagentStop, Stop`,
  `MCP servers (1) arggon`, `Skills (14)` incl. the 13 command names
- agents-key variant: with `"agents": [...]` → validate PASSES, details
  `Agents (0)`; without the key → `Agents (2)`
- `claude mcp list` (fixture tree) → `plugin:arggon:arggon: arggon mcp - ✔
Connected` + `arggon: arggon mcp - ⏸ Pending approval`
- NOT probed live: a real `SubagentStart` hook dispatch (needs a model session);
  the gate's agent_type semantics are covered by the child-process probes, the
  payload shape by the hooks reference and the item's probes.

## Coordination (not fixed here, by design)

The committed capability matrix (`templates/docs/adapters/capability-matrix.json`,
owned by sibling `task-claude-matrix-and-docs`) still reports claude's
`discipline-enforceable` as a gap and its `claim-integrity` note as "no
client-side backstop"; both are stale now that the PreToolUse gate ships
(`docs-travel-with-code` legitimately stays a gap). Row deltas observed:
`discipline-enforceable` → delivered by `claude:plugin.hooks.PreToolUse`
(fail-open, kernel still enforcement of record); `claim-integrity` note → the
reviewer backstop denies the mutating tool set while a review is in flight. The
matrix is not hand-edited here, per spec §"The honest starting floor".

## Port decisions (also recorded in the bundle README §Port notes + the PR)

command file stems drop the ZCode `arggon-` prefix (Claude emits
`<plugin>:<stem>` → `/arggon:<command>`); `/arggon:goal` renders the contract and
the session holds the loop (no Goal Mode); no goal-mode/automation templates
vendored; agent files keep `arggon-*.md` (wire id, ADR 0021 §6.2a′);
`MAX_ADAPTER_ARTIFACTS` 64 → 96 (three seams are 67 destinations, the old cap
truncated the newest adapter's rows); `skills/arggon-cli/SKILL.md` one-word
vocabulary fix (`coordinator` → `delivery-lead`, ADR 0021 §6.1) forced by the
family drift guard now walking the vendored copy.

### handoff 2026-10-14 @Arggon — next: Review PR #821 (maker work complete, all gates green); verify the 14 acceptance boxes against the evidence comment, then run the standards reviewer and merge.

- branch: feat/task-claude-plugin-seam
- open questions: Capability-matrix claude row deltas + ADR 0020 stale amendments belong to task-claude-matrix-and-docs / a follow-up item (reported in the PR); live SubagentStart hook dispatch not probed (needs a mod…

### 2026-10-14 @Arggon

Review round 1 fixes (delivery lead) — applied, commit `abf9f9db` (pushed on `feat/task-claude-plugin-seam`, PR #821).

1. `ArggonManager/docs/json-output.md` (`adapters.artifacts` row): cap updated to
   `MAX_ADAPTER_ARTIFACTS` (96), with the 69-destination context. Sweep command run:
   `grep -rn "MAX_ADAPTER_ARTIFACTS\|artifacts.*64" ArggonManager/docs README.md skills/arggon-cli`
   → the only hit is the updated row; the `agents[].files` row's
   `MAX_ADAPTER_AGENT_FILES` (64) is a different cap and was left untouched.
2. `cli/src/adapters.ts` cap comment: arithmetic corrected — opencode (18) +
   zcode (23) + claude (28) is **69** destinations (claude's 28 includes the two
   floor surfaces); the reasoning (old 64 truncated the newest adapter's rows) stands.
3. `cli/src/init-claude.test.ts`: test-title typo `argxon_show` → `arggon_show`.

Checks (worktree, all green): `npx vitest run cli/src/init-claude.test.ts
cli/src/adapter-selection.test.ts cli/src/mcp-doc-contract.test.ts` → 81 passed /
0 failed; `npx prettier --check` on the three touched files → clean;
`npm run arggon -- validate` → `ok:true`, 0 errors, 0 warnings.

### 2026-10-14 @Arggon

verdict: approve

### Lead review + merge verification — 2026-10-14 (delivery lead)

Merged as 3cc9587c (PR #821). Ships: templates/docs/claude/** (marketplace catalog + vendored plugin: 2 agents, 13 /arggon:<command> commands, hooks pair with the gate, bundled skill, seam README), the init/selection wiring, the repo-self .claude-marketplace/** with its x-generated rows, and the headless bar.

**Review bar (ArggonManager/docs/engineering.md §Review bar).** Architecture & boundaries: one classification point extended (adapters.ts), the gate is a bounded port of the ZCode seam — independently diffed by argon-standards-reviewer with only the intended event-model and scoped-prefix deltas; nothing under adapters/**, no settings stanza, no second skill copy. Conventions: marker syntax per destination, post-rename vocabulary, commands drive mcp__arggon__*. Evidence travels: full suite 158/3457 + lint + structure + validate re-run read-only by argon-verifier; init-claude.test.ts 24/24 with the live claude 2.1.289 probes EXECUTED (not skipped); fixture init --agents claude = 28 written / truncated:false and --agents opencode,zcode writes nothing claude. Docs travel: spec 024 facts corrected with the probe (the 2.1.289 agents-omission finding, test-pinned); README + seam README updated; json-output.md cap 96. Scope stayed on the item.

**Review rounds.** Round 1 (lead): three must-fix nits landed in abf9f9db (json-output cap number 64→96; adapters.ts destination arithmetic 67→69; a test-title typo). Independent standards pass: no blockers, no should-fix; its optional nits are filed as task-claude-gate-polish, with the weaker observations recorded there as context (marker-loss durability gap pre-existing across seams; two expectations derive from the same classifier; one historical comment's file count).

**Residuals (recorded, not hidden).** A real SubagentStart/SubagentStop dispatch was not probed live — verifier probe 4 recorded `not feasible: no authenticated throwaway session`; the gate semantics are covered by child-process probes. Hooks stay fail-open per spec (kernel remains enforcement of record). The adapter-selection doctor snapshot still asserts the pre-wave discipline-enforceable gap text — task-claude-matrix-and-docs (depends_on this) flips it.
