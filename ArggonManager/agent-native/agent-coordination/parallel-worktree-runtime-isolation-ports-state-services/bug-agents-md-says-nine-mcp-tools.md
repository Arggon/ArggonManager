---
type: bug
status: in_progress
id: bug-agents-md-says-nine-mcp-tools
title: "`docs/agents.md:410` says `arggon mcp` exposes NINE tools; shipped is FIFTEEN — and `agents.md:586` contradicts its own line 410"
assignee: Arggon
branch: fix/bug-agents-md-says-nine-mcp-tools
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs, mcp]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T10:44:59.713Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-agents-md-says-nine-mcp-tools
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-agents-md-says-nine-mcp-tools.md
  Leaves live only under a story. id is the filename stem: bug-agents-md-says-nine-mcp-tools.
  CLI `arggon create bug agents-md-says-nine-mcp-tools` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/agents.md:410` says `arggon mcp` exposes NINE tools; shipped is FIFTEEN — and `agents.md:586` contradicts its own line 410

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Found by the worker on PR #610 (task-adr0020-claude-seam-statement-stale), 2026-10-03, reported rather than fixed because `docs/agents.md` is a methodology CARRIER and editing it inside a one-file ADR PR would have widened the blast radius.

**The defect.** `ArggonManager/docs/agents.md:410` (the MCP server section) says `arggon mcp` exposes **nine** tools. Shipped is **fifteen** — ADR 0014 grew the surface (priority, sync, import_issues, start, branch, cleanup) — and **`:586` in the same file already says fifteen**. So the carrier contradicts itself, and an agent reading the §MCP server section is told a third of the surface exists.

This is a carrier change, so per `docs/agents.md` §Changing the methodology it is **Behavioral** with an ADR 0016 reference, and the skill's copies must stay byte-equal in the same PR. That is exactly why the worker was right to file it rather than absorb it.

Note the shape: this is the same drift class as `bug-engineering-doc-stale-adr-statuses` (an ADR status claim in a carrier) and `bug-mcp-budget-contradicted-across-docs` (a budget figure stated twice with different numbers). Three this session, all "a carrier restates a fact that changed elsewhere, and the restatement was never updated."

Acceptance:

- [x] `agents.md:410` corrected to the shipped count, sourced from `cli/src/mcp-server.ts` (the tool registry) rather than a copy of another number
- [x] The whole carrier swept for any other stale MCP tool count or tool-name list
- [x] `skills/arggon-cli/` and its byte-equal `.agents/skills/` copy updated in the SAME PR (Behavioral → adopter-upgrade channel per ADR 0016) — ticked as satisfied by the sweep, not by an edit: the skill already stated fifteen and named all fifteen, so it needed no change and `npm run skills:sync` re-verified the byte-equal copy. Rationale in the worker comment below.
- [x] A check pins the documented count to the registry so this cannot drift again — a doc-contract test is the pattern the repo already uses (`adr-index-parity`, `opencode2-doc-contract`)
- [x] State the impact class (Behavioral) in the PR and as an item comment

### 2026-10-03 @ses_efea13a3fffefqFSMqOrGrzc22
**Impact class: Behavioral** (docs/agents.md §Changing the methodology) — a carrier changed, so this PR references the adopter-upgrade channel (ADR 0016). What an adopting repo's agents must re-learn: the `arggon mcp` surface is FIFTEEN tools, not nine, and the pinned native subset is not "the core nine".

**Sweep result** (corpus: the three carriers `agents.md`/`engineering.md`/`convention.md`, `skills/arggon-cli/**`, plus `README.md`, `json-output.md`, `docs/playbooks/**` and every tracked markdown; source of truth read from the `TOOLS` array in `cli/src/mcp-server.ts`, 15 entries in `tools/list` order).

FIXED (same fact — the nine-item enumeration of the `arggon mcp` surface, restated in three documents, so fixing one would have left the contradiction standing):
- `docs/agents.md:410` — "as nine tools: <9 names>" → fifteen, all 15 named, grouped like the skill (core nine / kernel three / worktree three).
- `docs/json-output.md:14` — the same nine-name list with NO count word at all (so it drifted invisibly); now names all 15.
- `README.md:619` — same nine-name list, no count word; now names all 15.
- `docs/agents.md` §OpenCode V2 — "the core nine also `options.pinned`" was numerically right (9) but set-wise false: W4 moved `start` into `PINNED_TOOL_NAMES` and left `report` out, so the phrase implied `report` is pinned. Now names the nine the plugin actually pins.

FOUND, ACCURATE, LEFT ALONE (reported, not changed):
- `skills/arggon-cli/references/json-contract.md:77-81` — already says **Fifteen tools** and lists all 15; `SKILL.md`'s native-tools bullet also lists 15 by name. This is why acceptance box 3 is ticked without a skill edit.
- `docs/agents.md:597` (§ZCode) — "the **fifteen-tool** MCP surface" is correct.
- `docs/playbooks/opencode.md:213-216` — names the pinned subset exactly (`list`…`start`, with the unpinned maintenance tools listed); correct, and the phrasing I mirrored into the carrier.
- Historical records left as-is by design (this repo supersedes rather than rewrites): ADR 0006:76, ADR 0007:33, ADR 0014:33 vs :40, `plans/plan-zcode-native-seam-012.md:24`, `cli/src/measure.ts:39-40` (dated "nine-tool baseline", contrasted with the live 15-tool figure).
- `cli/src/mcp-smoke.test.ts:102-118` hand-types all 15 names — a mirror, but a LOUD one (it fails on any registry change), unlike prose. Left alone.

NO FOURTH INSTANCE of the class found: `docs/engineering.md` and `docs/convention.md` carry no MCP tool count or name list, and every `arggon_*` name across the corpus resolves to a registered tool (the check now enforces exactly that). `bug-mcp-budget-contradicted-across-docs`, `bug-engineering-doc-stale-adr-statuses` and `task-skill-json-contract-names-claude-code` are untouched and not absorbed.

**The check** — `cli/src/mcp-doc-contract.test.ts` (14 assertions), pinned to the REAL corpus (`MCP_TOOL_NAMES` from the registry, `nativeToolSchemas()`/`PINNED_TOOL_NAMES` from the plugin source), never a fixture:
1. membership of every documented enumeration, BOTH directions, failing with the tool name (`arggon_priority is shipped but never named`);
2. the number word printed next to "tools" equals the registry size (a complete set with a lying headline still fails);
3. no agent-facing document names a tool the registry does not ship;
4. the tools agents.md names next to `options.pinned` equal the plugin's pinned set, and its "fifteen Code Mode tools" equals the native registry size;
5. every `PINNED_TOOL_NAMES` entry is a real native tool.

Expected vs observed (drift simulated, then reverted): restoring the nine-tool sentence → 3 failures naming all six never-named tools plus `says "9 tools"`; `arggon_rename` swapped into README → `arggon_rename is named but not shipped`; "the core nine also `options.pinned`" → all nine pinned names reported as never named; "fourteen Code Mode tools" → `says "14 tools", plugin registers 15`. Clean tree: 14/14 pass.

Gates (after `npm run build`, on the rebased tree): `npm test` 125 files / 2569 tests pass, `npm run lint` 0, `npm run check:plugin` clean (bundle byte-identical), `npm run arggon -- validate` ok (0 warnings), `npm run test:structure` 4 passed, `npm run lint:structure` clean, `npm run skills:sync` synced 7 files with no diff. Rebased onto `origin/main` (was 11 behind), no force-push.

Left `in_progress` — completion is the coordinator's call after merge.
