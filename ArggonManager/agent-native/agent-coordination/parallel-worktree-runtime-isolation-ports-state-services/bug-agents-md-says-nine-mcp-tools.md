---
type: bug
status: todo
id: bug-agents-md-says-nine-mcp-tools
title: "`docs/agents.md:410` says `arggon mcp` exposes NINE tools; shipped is FIFTEEN — and `agents.md:586` contradicts its own line 410"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs, mcp]
created: "2026-10-03"
updated: "2026-10-03"
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

### handoff 2026-10-03 @ses_efea13a3fffefqFSMqOrGrzc22 (session: ses_efea13a3fffefqFSMqOrGrzc22) — next: Coordinator reviews PR #615 against the review bar, then merges and flips bug-agents-md-says-nine-mcp-tools to done (checklist already ticked).
- branch: fix/bug-agents-md-says-nine-mcp-tools
- open questions: Acceptance box 3 ticked without a skill edit (the skill was already correct); README.md:619 and json-output.md:14 fixed as the same fact — flag if the coordinator wants those split into their own ite…

### 2026-10-03 @Arggon

### 2026-10-03 @Arggon (review, PR #615)
verdict: approve

Reviewed by reading only (no gates re-run by the reviewer; CI lanes `cli`/`tasks-validate`/`ui-smoke` green on 5734ace6).

**1. Counts and lists are right, sourced from the registry.** `cli/src/mcp-server.ts:81-549` `TOOLS` = 15 entries in `tools/list` order: list, create, update, comment, handoff, show, next, report, validate, priority, sync, import_issues, start, branch, cleanup. The new `agents.md:410` grouping (core nine / kernel three / worktree three) is an exact partition of those 15 — no overlap, no omission, same order. Group labels verified against the code, not assumed: `spawnedOutcome(` has exactly three call sites (mcp-server.ts:772, :786, :790 — `start`/`branch`/`cleanup`), and its own doc says "Run one CLI flow (`start`/`branch`/`cleanup`)", so "the worktree lifecycle … each of which re-enters the CLI as an argv array with no shell" is true of those three and false of the other twelve; `priority`/`sync`/`import_issues` are in-process, matching the skill's "kernel operations, in-process". `json-output.md:14` and `README.md:619` name the same 15 in registry order. Independently confirmed order via `cli/src/mcp-smoke.test.ts:100-118`, which drives a real `tools/list` over a spawned server and asserts the identical 15 names/order — a loud mirror, not a second prose copy.

**2. The set-wise correction is right and complete.** `PINNED_TOOL_NAMES` (opencode/plugins/arggon/index.ts:1285-1295) = list, create, update, show, next, validate, comment, handoff, **start** — 9 names, `report` absent. The new carrier wording names exactly those nine. The old wording really did imply `report` was pinned: §MCP server defines "the core nine" as list/create/update/comment/handoff/show/next/**report**/validate, so "the core nine also `options.pinned`" asserted `report` pinned (it is not) and silently dropped `start` (it is). "nine of them also `options.pinned`" fixes both and drops the ambiguous "core" label. `playbooks/opencode.md:213-216` is accurate and was correctly left alone — it enumerates the pinned set explicitly.

**3. The check is a real contract, not a tautology.** `MCP_TOOL_NAMES` is *derived* (`TOOLS.map(t => t.name)`, mcp-server.ts:558) and asserted only against documents — no assertion compares a document to a value derived from that document. Opposite-side pairs: doc names ↔ registry (`namedTools` vs `REGISTRY`), doc number word ↔ `REGISTRY.length`, corpus names ↔ `REGISTERED`, `pinnedWindow` names ↔ `nativeToolSchemas().filter(pinned)` (which itself derives from `PINNED_TOOL_NAMES`), doc count ↔ `NATIVE.length`, `PINNED_TOOL_NAMES` ↔ `NATIVE_NAMES`. Two premise guards (non-empty, no duplicates, `arggon_` prefix) stop the membership rules passing vacuously on a broken registry. 14 assertions = 1 + 4×2 + 1 + 4, matching the claim. Failure modes are loud, not silent: `paragraphWith` asserts exactly one anchor paragraph (deleting the sentence fails with "update this suite's anchor"); the count rule requires `counts.length > 0`, so the original "silent list with no count word" defect is now impossible; `pinnedWindow` on a lost parenthetical yields an empty set and reports all nine as never named. The lossy `.filter(NATIVE_NAMES.has)` cannot mask a typo — a misspelled pinned name is filtered out and then reported as "pinned but never named".

**4. The four drift simulations are real and readable** (verified by reading the regexes/sets, not by running them): restoring "nine tools" gives `counts=[9]` vs 15 and six symmetric-difference lines; `arggon_rename` in README is picked up by `namedTools` and reported by both the membership and corpus rules; "fourteen Code Mode tools" gives `counts=[14]` vs `NATIVE.length` 15 — and the sibling "nine of them also `options.pinned`" does *not* false-fire (its three gap words exceed the {0,2} bound and the next token is a backtick), so the message would name only the real drift. `namedTools` normalises both client spellings; `arggon_arggon_<tool>` placeholders in `.opencode/agents/*` and `templates/docs/opencode/agents/*` do not produce phantom names (backtick + `<` fails the match).

**5. Classification and skill sync.** Behavioral is correct under §Changing the methodology: `agents.md` is a declared carrier and the agents-facing tool count changed. The ADR 0016 reference is in the PR body, the commit message and the item comment; acceptance box 5 satisfied. `skills/` and `.agents/skills/` are byte-equal modulo the generated provenance marker (the shape `skill-copy.test.ts` pins per agents.md:503), the branch diff touches neither tree, and nothing is hand-copied.

**6. Scoping of what was left alone was right.** `skills/…/json-contract.md` already said "Fifteen tools" and named all fifteen — verified. `agents.md:597` §ZCode "the **fifteen-tool** MCP surface" is correct. `playbooks/opencode.md:213` is correct. The dated records (ADR 0006/0007/0014, `plans/plan-zcode-native-seam-012.md`) are correct to leave. **`cli/src/measure.ts` too**: the "9 tools, 9,040 B" string is inside a comment explicitly dated 2026-09-15 and contrasted with "the full 15-tool surface measured 15,701 B" in the same comment, while the live exported constant is `MCP_TOOLS_BASELINE_BYTES = 15_701` — rewriting the dated baseline would falsify the record, and the live figure is already right. I also ran the worker's "no fourth instance" claim independently over all non-tracked markdown: zero `arggon_*` names outside the registry, and the only other count-near-"tools" phrases are correct (`"twelve kernel tools"` in `opencode2.md:75`/`playbooks/opencode.md:521` = the 12 kernel specs + 3 worktree = 15; `"15 tools, 9 pinned"` at playbook:435 is right).

**7. The README incident left no damage.** Final `README.md:619` is complete: the stale nine-list replaced by all 15, the trailing "Optional: OpenCode V2 does not need it… See … §MCP server." intact, `git status` clean, branch diff limited to the 6 intended files. The surviving README change is the one-line paragraph — no half-restored text.

**Smoke bar:** not applicable — no CLI behavior or UI change (docs + one new test + one additive derived export; `instructions.ts` extracts its snippets from `ci.md`, so the carrier paragraph feeds no generated seam, and the 2 KB budget applies to the generated `AGENTS.md`, not the carrier). The registry itself stays smoke-covered by `mcp-smoke.test.ts` driving a real `tools/list` in the `cli` lane.

**Non-blocking nits (do not hold the merge):**
- Rule 3's scan covers 5 named files + 5 dirs; `ArggonManager/docs/opencode2.md`, `ArggonManager/docs/playbooks/**`, non-`templates/docs` template trees and `labs/` are not scanned. The PR body says "every `arggon_*` name anywhere in the corpus resolves to a registered tool" — true of the sweep, slightly stronger than what the test *enforces*. Worth a follow-up task widening `CORPUS_FILES`/`CORPUS_DIRS` if the coordinator wants the claim to match the gate.
- `.filter((name) => NATIVE_NAMES.has(name))` in the pinned assertion means a stray backticked non-tool token inside the `options.pinned` window is dropped rather than reported. Cosmetic; the set still has to match exactly.
- The playbook's "**core nine**" label is loose in the same way the carrier's was (the nine include W4's `start`, which is not in the §MCP-server core nine), but it enumerates them, so it does not mislead. The carrier's new wording deliberately avoids the label.

**Recommendation: merge**, then flip the item to `done` (checklist already ticked; completion is the coordinator's call).
