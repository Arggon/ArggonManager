---
plan_id: opencode2-009
title: Plan for OpenCode2 complete refactor
spec: ArggonManager/docs/specs/spec-opencode2-009.md
status: implemented
created: 2026-09-18
---

# Plan: OpenCode2 complete refactor (opencode2-009)

Derived from `ArggonManager/docs/specs/spec-opencode2-009.md`. Each task carries a
verifiable acceptance criterion and links back to the spec. Waves are ordered
by dependency; items within a wave are file-disjoint and can be orchestrated in
parallel per [ArggonManager/docs/agents.md](../agents.md) (one worktree per item).

Branch model: the program lands on the long-lived integration branch
**`opencode2`** (one worktree per wave item merged into it). `main` stays
untouched by product decision (2026-09-18): adopters who want the native
OpenCode V2 surface use `opencode2`, which receives `main` merges as needed.
W7 closes the program on that branch.

## T1: W0 — Program foundation

- ADR 0010 (Proposed), spec-opencode2-009, this plan, epic `opencode2`, story
  and item structure. Items: `task-opencode2-plan`, `task-opencode-v2-adr`.
- **Acceptance:** `arggon validate` and `spec validate` clean; ADR links the
  exploration; tracker shows epic → story → items with `depends_on` edges.

## T2: W1a — Seam spec and plan

- Write `ArggonManager/docs/specs/spec-opencode-seam-NNN.md` + plan: the exact generation
  contract for `.opencode/` artifacts (config only when absent, agents,
  commands, slim `AGENTS.md`), invariants (never overwrite, valid JSON, parity),
  and file-by-file shapes. Item: `task-opencode-v2-spec`.
- **Acceptance:** spec/plan validate clean; contract names every generated file,
  its template source, its `x-generated` entry and its test.

## T3: W1b — Implement the generated seam

- Extend `cli/src/docs.ts` (template walk) + `templates/opencode/**` + skills
  bundling unchanged; generate: `opencode.jsonc` (only when no config exists at
  root or `.opencode/`), `agents/arggon-coordinator.md`, `agents/arggon-worker.md`,
  `agents/arggon-reviewer.md`, `commands/arggon-*.md`, slim `AGENTS.md` router.
  Tests mirror `cli/src/init-docs.test.ts` (created/skipped/modified/backup) plus
  JSON validity. Items: `task-opencode-v2-spec` implementation half.
- **Acceptance:** on a fresh fixture, `init --full` creates the files and
  `init` re-runs refresh untouched ones; on an adopter with `opencode.json`, no
  config is written and the JSON list reports the skip; parity/JSON tests green.

## T4: W1c — Doctor OpenCode checks

- Additive `opencode` block in `doctor --json`: config files, V1-shaped keys
  (top-level `mcp.<name>`, `enabled`, `autoupdate`, `permission`, `tools`,
  `maxSteps`), artifact presence, `.agents/skills/*`, native MCP registration vs
  `.mcp.json` only, with actionable hints. Item: `task-opencode-v2-doctor`.
- **Acceptance:** report-only (exit 0), bounded output; tests for V1-shaped and
  clean fixtures; `ArggonManager/docs/json-output.md` documents the block.

## T5: W1d — Playbook and reference docs

- `ArggonManager/docs/playbooks/opencode.md` (2.0.7) through the playbook pipeline;
  `ArggonManager/docs/agents.md` §Reference integrations gets the OpenCode V2 subsection;
  README wiring updated. Item: `task-opencode-v2-playbook`.
- **Acceptance:** `arggon playbook status` current; `arggon instructions`
  section parity if an extraction hook is added; no doc statement contradicts
  shipped behavior.

## T6: W2a — Plugin skeleton and bundling

- Source `opencode/plugins/arggon/index.ts` (TypeScript, V2 Promise plugin),
  bundled by `init` to `.opencode/plugins/arggon/` with a generated marker;
  byte-parity test against the bundled copy (mirrors `skill-copy.test.ts`);
  `x-generated` provenance entry. Item: `task-opencode-v2-plugin`.
- **Acceptance:** parity test fails on drift; `init` re-run refreshes untouched
  copies and skips modified ones; plugin loads in a real V2 session (evidence).

## T7: W2b — MCP auto-registration and failure isolation

- `ctx.mcp.transform` registers `arggon` (`{type:"local", command:["arggon","mcp"]}`)
  only when `editor.get("arggon")` is absent; every plugin path is wrapped so a
  failure logs and no-ops; smoke proves CLI/MCP still work with the plugin
  broken/absent. Item: `task-opencode-v2-plugin`.
- **Acceptance:** in a fixture with no MCP config, a V2 session sees the arggon
  MCP tools; in a fixture with a pre-existing `arggon` server, the config is not
  clobbered; a synthetic plugin error does not break the session or the CLI.

## T8: W2c — Smoke harness for the V2 surface

- Scripted `opencode run` evidence harness (npm script, e.g.
  `npm run smoke:opencode`) that boots a fixture repo, asserts skill discovery,
  agents/commands visibility, MCP registration, context injection and a full
  next → start → done cycle; transcripts stored as review evidence (ADR 0008
  spirit for the V2 surface). Items: `task-opencode-v2-plugin`,
  `task-opencode-v2-doctor` (consumes the harness).
- **Acceptance:** harness runs headless in CI-like conditions and fails on any
  regression of the listed assertions; transcript attached to the wave PR.

## T9: W3a — Session ↔ item correlation and bounded context

- Plugin resolves the active item (storage map set from observed `arggon` calls,
  VCS branch `feat/<id>`/`fix/<id>` fallback, explicit env override), caches the
  `arggon show --json` block briefly, and injects a bounded system part via
  `session.hook("context")`; no-op outside ArggonManager trees. Item:
  `task-opencode-v2-plugin`.
- **Acceptance:** a real session on a claimed item shows the item block once per
  context call (bounded, no unbounded reads); after compaction the block is
  still present; on a repo without `tasks/` the hook is silent; measured token
  size of the block ≤ the documented bound.

## T10: W3b — Session ergonomics and hygiene

- On claim detection: rename the session to the item id (and surface the
  worktree path for `session_move` guidance); optional flag: warn when
  `arggon validate --json` fails after a shell commit. Item:
  `task-opencode-v2-plugin`.
- **Acceptance:** rename observed in a real session; warning appears only on
  failing validate and never blocks; both behaviors are documented as
  non-authoritative (gates stay in pre-commit/CI).

## T11: W3c — MCP session attribution (`_meta.sessionID`)

- Kernel-side: default `session`/`author` for `arggon_handoff`/`arggon_comment`
  from `_meta.sessionID`; explicit args win; opaque correlation only. Item:
  `task-opencode-v2-mcp-meta`.
- **Acceptance:** parity tests green; new tests for present/absent/precedence;
  no payload shape change beyond documented fields.

## T12: W4a — Agents and wave commands

- Generated `arggon-coordinator` (primary), `arggon-worker`, `arggon-reviewer`
  (edit-deny) with system prompts derived from `ArggonManager/docs/agents.md` orchestration;
  commands `/arggon-review` and `/arggon-done` encode the review bar and the
  done criteria. Item: `task-opencode2-orchestration`.
- **Acceptance:** agents are visible with correct modes/permissions in a real
  session; a worker cannot edit outside its worktree by permission (probe);
  reviewer cannot edit (probe); command frontmatter (`agent`, `subagent`) is
  correct.

## T13: W4b — End-to-end wave run

- Scripted end-to-end on a fixture with a local bare remote: coordinator claims
  two file-disjoint items, launches two workers (background subagents), each
  runs next → start --worktree → implement → validate; reviewer produces a
  verdict with smoke evidence; coordinator verifies merge order. Item:
  `task-opencode2-orchestration`.
- **Acceptance:** transcript shows two parallel workers on disjoint worktrees,
  a review verdict on the item (via `arggon comment`), and the documented gates
  enforced; total context per worker measured and recorded (feeds W6).

## T14: W5 — Methodology commands and skill progressive disclosure

- `/arggon-spec`, `/arggon-adr`, `/arggon-explore`, `/arggon-playbook` commands
  driving the existing CLI scaffolds; refactor the `arggon-cli` skill into the
  umbrella `SKILL.md` + `references/` (json-contract, methodology, orchestration,
  pitfalls) with source/bundle parity tests. Item: `task-opencode2-methodology`.
- **Acceptance:** each command scaffolds/validates on a fixture; skill references
  load on demand in a real session; `skills:sync` + parity tests green; the
  advertised skill description stays within the documented bound.

## T15: W6 — Context and token accounting

- Measure the V2 prompt surface before/after per wave using `doctor --budget`
  and a scripted token count of system-prompt contributions (AGENTS.md, skill
  descriptions/bodies, tool schemas, injected item block); tune skill bodies,
  descriptions, agent prompts and compaction retention; record numbers in the
  plan as evidence. Item: `task-opencode2-context`.
- **Acceptance:** before/after table with method and dates; no regression above
  the agreed bound on any wave; regressions fixed or explicitly waived with
  rationale.
- **Recorded evidence (2026-09-18, `task-opencode2-context` / PR #329):**
  reproducible report `npm run context:report [--strict]` (report-only, no model
  calls; bytes/4 token heuristic). Fixed per-session surface ≈12,852 B
  (≈3,213 tok): generated `AGENTS.md` 1,863 B (≤2,048 B test-enforced), skill
  entries 500 B, agent descriptions 393 B, live MCP `tools/list` 10,096 B
  (9 tools; under the 12,288 B advisory, +1,056 B/+11.7% vs the 9,040 B baseline
  at commit `5d6c504`). Injected item block: fixture max 252 B, real sessions
  observed 312 B (≤1,024 B bound); compaction `keep.tokens` kept at 15,000 (V2
  default). W5 skill split:
  21,955 B always-loaded before → 9,518 B umbrella + 15,479 B `references/` on
  demand (−57% on load). W1–W5 per-wave captures were impossible (W6 ran last);
  the item documents that deviation and the reconstruction honestly.

## T16: W7 — Dogfood and release

- This repo carries the generated surface (self-host), the plugin is exercised
  by real sessions, the playbook is current, README + ArggonManager/docs/agents.md +
  ArggonManager/docs/json-output.md updated, the program close-out PR on `opencode2`
  references epic `opencode2` and closes the spec/plan (statuses
  `implemented`). Item: `task-opencode2-dogfood`.
- **Acceptance:** `arggon validate`, `spec validate`, full test suite and the
  smoke harness green; a real session on this repo demonstrates the loop
  end-to-end; spec/plan statuses flipped in the same PR.

## Risks and rollback

- **V2 churn**: pin the plugin to the tested API, feature-detect, keep the
  plugin optional; a broken plugin leaves the CLI/MCP path untouched (I5).
- **Vendored drift**: parity tests + provenance; `init` re-run is the upgrade
  path; a publishing decision is deferred by ADR 0010.
- **Scope creep**: each wave ships alone; W1 works without the plugin, W2
  without context, etc.; the program stalls safely at any wave boundary.
- **Rollback**: removing `.opencode/` and the generated config restores the
  status quo ante; nothing in the core depends on the surface.
