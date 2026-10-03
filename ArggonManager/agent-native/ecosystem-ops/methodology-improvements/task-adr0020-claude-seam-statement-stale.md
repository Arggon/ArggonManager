---
type: task
status: in_progress
id: task-adr0020-claude-seam-statement-stale
title: "ADR 0020 now understates the Claude Code seam: `.mcp.json` → `arggon mcp` delivers 15 tools/envelopes, so \"remains docs + CLAUDE.md\" is no longer accurate"
assignee: Arggon
branch: feat/task-adr0020-claude-seam-statement-stale
parent: methodology-improvements
labels: [adr, docs]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T02:50:04.107Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr0020-claude-seam-statement-stale
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr0020-claude-seam-statement-stale.md
  Leaves live only under a story. id is the filename stem: task-adr0020-claude-seam-statement-stale.
  CLI `arggon create task adr0020-claude-seam-statement-stale` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0020 now understates the Claude Code seam: `.mcp.json` → `arggon mcp` delivers 15 tools/envelopes, so "remains docs + CLAUDE.md" is no longer accurate

## Context

Found by the reviewer of PR #600 (task-capability-matrix), 2026-10-02.

ADR 0020 (Accepted, this coordinator wrote it) states Claude Code "remains docs + `CLAUDE.md`". That is now understated: `.mcp.json` is committed and init-generated (`cli/src/docs.ts:278`, asserted `cli/src/init.test.ts:389`) and registers `arggon mcp` for any MCP client, so a Claude Code client already runs the full 15-tool surface with the same envelopes and kernel operations. The capability-matrix work proved this end to end, and three `claude` rows were corrected from `gap: true` to `gap: false` because of it.

The ADR is the durable record and it currently understates a shipped surface — the same class as ADR 0019's stale decision point that PR #598 just fixed. What genuinely IS missing on Claude Code is narrower and belongs in the ADR: no `.claude/` hook or permission config (so no client-side `PreToolUse` gate) and no session context hook. Amend the existing ADR with a dated amendment (do not rewrite, do not renumber).

## Acceptance

- [x] A dated amendment to ADR 0020 corrects the Claude Code statement: name the `.mcp.json` → `arggon mcp` 15-tool surface as delivered, and state the actual gaps (no client-side hook/permission gate, no session context hook) — PR #610, three dated amendments (frontmatter bullet + one blockquote at §Context, one at §Consequences); both gaps stated as the client-side layer the follow-on story owes
- [x] The amendment is sourced to shipped code (`cli/src/docs.ts` init destination, `docs/agents.md` "still serves other clients"), not to the capability matrix's prose — `DOC_PATH_MAP["mcp-json"]`, `TIER1_DOCS`, `AGENT_TEMPLATES` (claude), the 15 tools in `cli/src/mcp-server.ts`; the matrix prose is cited nowhere
- [x] `Status: Accepted` and the ADR's number are untouched; nothing rewritten in place — the ADR diff is additive (62 insertions / 0 deletions, plus a 4-line reflow to stamp the PR number); both original sentences still readable verbatim

## Notes

### 2026-10-03 @Arggon
ADR 0020 amended in **PR #610** (docs-only, 1 file). Branch `feat/task-adr0020-claude-seam-statement-stale`, worktree `../ArggonManager-task-adr0020-claude-seam-statement-stale`. Item left `in_progress` for the coordinator.

**Shape** — dated-amendment idiom of ADR 0019 (`Amendment (2026-10-02, PR #568)`, PRs #573/#579) and ADR 0018 (PR #544): one frontmatter `Amendment (2026-10-02, PR #610)` bullet + one blockquote amendment at each of the two understated points (§Context "Claude Code has only a `CLAUDE.md` pointer"; §Consequences "today it remains docs + `CLAUDE.md`"). Original text, `Status: Accepted`, the ADR number and the filename all untouched; the ADR diff is additive (62 insertions / 0 deletions, plus a 4-line reflow to stamp the PR number). `docs/adr/README.md` not touched — its 0020 row is still `Accepted`, which the parity test confirms.

**Exact sources cited in the amendment** (file + symbol/key, never line numbers — the item's own `cli/src/docs.ts:278` is now `:307` and `docs/agents.md:546` is now `:557`, which is why the ADR cites keys instead):

- `.mcp.json` is an init destination → `DOC_PATH_MAP["mcp-json"] = ".mcp.json"` in `cli/src/docs.ts` (now line 307), template `templates/docs/mcp-json`.
- init writes it → `cli/src/init.test.ts`: `.mcp.json` in `TIER1_DOCS`, asserted by "generates missing docs on an already-initialized tree (restore-on-rerun)" via `expect(result.created).toEqual(TIER1_DOCS)`. (The item's `init.test.ts:389` is a *dry-run* assertion — `dry.updated` contains `.mcp.json` — so I cited the stronger create assertion instead.)
- the file registers the server → `templates/docs/mcp-json` = `{"mcpServers":{"arggon":{"command":"arggon","args":["mcp"]}}}`; committed root `.mcp.json` is byte-equal.
- the claude seam owns exactly those two destinations → `cli/src/adapters.ts`, `AGENT_TEMPLATES`: `{ agent: "claude", match: (t) => t === "docs/CLAUDE.md" || t === "docs/mcp-json" }` (with its own comment: "claude-code has no bundle yet").
- "still serves other clients (e.g. Claude Code)" → `ArggonManager/docs/agents.md:557` (§OpenCode V2).
- "as part of the `claude` adapter seam" → `ArggonManager/docs/agents.md:410` (§MCP server).
- fifteen tools → `cli/src/mcp-server.ts` registers `arggon_list, create, update, comment, handoff, show, next, report, validate, priority, sync, import_issues, start, branch, cleanup` = 15 (verified by parsing the tools array); same list in `skills/arggon-cli/references/json-contract.md` §MCP surface and ADR 0014 §Decision 1.
- same envelopes → `ArggonManager/docs/json-output.md`; kernel shared via `@arggondev/lib` (`lib/src/operations.ts`).
- no claude hook/permission config → no claude bundle under `templates/docs/**`; the `AGENT_TEMPLATES` claude entry matches nothing else; contrast `templates/docs/opencode.jsonc` (deny rules, `git push --force*` etc.) and `templates/docs/zcode/arggon/hooks/{hooks.json,gate.mjs}` (PreToolUse/PostToolUse/Stop).
- no session context hook → `ctx.session.hook("context")` registration + bounded item block exist only in `opencode/plugins/arggon/index.ts` (`hook("context", …)`, `ITEM_BLOCK_MAX_BYTES`).
- follow-on story → `ArggonManager/docs/specs/spec-methodology-adapters-017.md` §S6 (bundle under `adapters/claude/`; `adapters/` today holds only `capability-matrix.json`).

The capability matrix's prose is cited nowhere in the amendment.

**Sweep for the same sentence elsewhere**
- `README.md` (tier-1 list, `--agents` §) — already accurate: `.mcp.json` "registers the arggon MCP server … part of the `claude` seam", and `claude` owns "the `CLAUDE.md` → `@AGENTS.md` pointer and the `.mcp.json` registration of `arggon mcp`". No change.
- `ArggonManager/docs/opencode2.md` — no Claude-seam claim (only "V2 reads `AGENTS.md` only — no `CLAUDE.md` fallback"). No change.
- `.agents/skills/`, `.opencode/`, `.zcode-marketplace/`, `skills/`, `templates/` — swept for the characterization and for the agents.md phrase: zero occurrences. (`templates/docs/CLAUDE.md` is the one Claude template, `@AGENTS.md`; `.zcode-marketplace/…/hooks.json` mentions `${CLAUDE_PLUGIN_ROOT}` only.) No `skills:`/`templates:` edits, so no `npm run skills:sync` or committed-copy refresh is owed.
- `ArggonManager/docs/explorations/exploration-methodology-productization-018.md:55` ("Minimal: root `CLAUDE.md` pointer + shared skill copy") — **left as written on purpose**: an exploration is the dated point-in-time record this ADR cites as `Input`; the ADR is where a correction belongs. Reported for the record.
- **Two pre-existing staleness spots found, NOT fixed here (out of this item's scope — please decide whether to file):**
  1. `ArggonManager/docs/agents.md:410` says `arggon mcp` "exposes … as **nine** tools" and lists nine, while the shipped surface is fifteen (ADR 0014 §Decision 1 grew it; `docs/agents.md:586` itself says "the **fifteen-tool** MCP surface"). That paragraph's Claude characterization is correct — only the count is stale — and it is *carrier* text, so fixing it is a Behavioral-class methodology edit with its own classification, not a line in this ADR amendment.
  2. `skills/arggon-cli/references/json-contract.md` §MCP surface says "For clients with no code-mode tool API (ZCode, ADR 0014) it IS the native tool surface" — Claude Code is such a client and is not named. Adjacent omission, not the false claim; also carrier text (`skills/arggon-cli/**` → mirror refresh to `.agents/skills/` + `npm run skills:sync`).

**Impact class (`docs/agents.md` §Changing the methodology itself): Advisory.** The rule triggers on a PR touching a methodology carrier (`docs/agents.md`, `docs/engineering.md`, `docs/convention.md`, `skills/arggon-cli/**`); this PR touches none of them — it touches an ADR, the record of a decision. Nothing an agent must re-learn changes: no rule, no gate, no command contract, no pipeline step; the corrected fact is already binding via the carrier (`docs/agents.md` §MCP server), so there is nothing to re-read, and the only statements this makes false are the two ADR sentences, both amended. I considered Behavioral (a reader *is* told something new about a client surface) and rejected it deliberately; if the reviewer reads it the other way the escalation is one line — add the ADR 0016 adopter-upgrade-channel reference.

**Gates** (`npm run arggon -- validate` ok/0 warnings · `npm run lint` clean · `prettier --check` on both touched files clean · `npx vitest run cli/src/adr-index-parity.test.ts` 7 passed · `npm test` 122 files / 2275 tests passed). First `npm test` run had two environmental failures, both re-run green after `npm run build`: `cli/src/headless-ci.test.ts` asserts `dist/cli.js` + `lib/dist/index.js` exist (fresh worktree), and `cli/src/prose-format.test.ts` hit its 30 s per-test timeout under parallel load (passes standalone, 25 s). Docs-only → smoke exempt. No code paths touched; `lib/src/items.ts`, `cli/src/board.ts`, `cli/src/goal-mode.ts`, `cli/src/start.ts` untouched (concurrent work).

### handoff 2026-10-03 @Arggon — next: Review + merge PR #610 (docs-only ADR 0020 amendment), then flip this item done.
- branch: feat/task-adr0020-claude-seam-statement-stale
- open questions: Advisory vs Behavioral impact class - judge; fix agents.md:410 nine-vs-fifteen tools count (carrier, Behavioral); name Claude Code in skill json-contract.md MCP-surface parenthetical?

### 2026-10-03 @Reviewer
verdict: approve (docs-only ADR amendment; no blocking findings)

Reviewed PR #610 (branch `feat/task-adr0020-claude-seam-statement-stale`, head `b980a0d0b`) against `ArggonManager/docs/engineering.md`. 2 files: the ADR (62 insertions / 0 deletions) + its own tracker item. I did not run gates; I read the diff, the cited code, the repo's own conventions, and the GitHub CI logs read-only.

## 1. Every claim is sourced to shipped code, never the matrix's prose — CONFIRMED
- Grep of the 62 added ADR lines for `matrix` / `capability-matrix` / `PR #600` / `task-capability`: **zero hits**. The matrix is cited nowhere, exactly as the item demanded.
- Every cited symbol exists and says what the amendment claims:
  - `cli/src/docs.ts:307` → `"mcp-json": ".mcp.json"` in `DOC_PATH_MAP` ✓ (the item's `:278` is stale — the worker's switch to citing the key is the right fix and is the substantive point of this item).
  - `cli/src/init.test.ts:51` `".mcp.json"` in `TIER1_DOCS`; the test at `:203` is named exactly "generates missing docs on an already-initialized tree (restore-on-rerun)" and asserts `expect(result.created).toEqual(TIER1_DOCS)` at `:209` ✓. The worker correctly **strengthened** the item's citation: `init.test.ts:389` is a dry-run `dry.updated` arrayContaining assertion, a weaker claim than "init creates it".
  - `templates/docs/mcp-json` = `{"mcpServers":{"arggon":{"command":"arggon","args":["mcp"]}}}`; `diff .mcp.json templates/docs/mcp-json` → byte-equal ✓.
  - `cli/src/adapters.ts:89-104` `AGENT_TEMPLATES`, claude entry verbatim `{ agent: "claude", match: (t) => t === "docs/CLAUDE.md" || t === "docs/mcp-json" }` ✓ (and its own comment says "claude-code has no bundle yet").
  - `cli/src/mcp-server.ts` registers exactly 15 tools — `arggon_list/create/update/comment/handoff/show/next/report/validate/priority/sync/import_issues/start/branch/cleanup` — matching the ADR's `arggon_list` … `arggon_cleanup` ✓; imports resolve through `@arggondev/lib` ✓; envelopes corroborated by `docs/agents.md` §MCP server + `docs/json-output.md` ✓.
  - `docs/agents.md` §MCP server: "**as part of the `claude` adapter seam**" ✓; §OpenCode V2: "still serves other clients (e.g. Claude Code)" ✓; §Pre-commit gate exists ✓.
  - `README.md:257` documents the same two-destination claude split ✓; `spec-methodology-adapters-017.md` §S6 is "Claude Code adapter (follow-on story)" with a bundle under `adapters/claude/`, and `adapters/` holds only `capability-matrix.json` ✓.
- Cross-check of the item's premise: `adapters/capability-matrix.json` claude rows — `same-rules`, `state-in-git`, `claim-integrity` are `gap: false`, two rows legitimately `gap: true` ✓ (three corrected, as stated).

## 2. The gaps named are the real ones — CONFIRMED
`find templates -iname "*claude*"` returns exactly one file: `templates/docs/CLAUDE.md`. `templates/docs/` has no hidden `.claude/`; no `settings.json` anywhere under `templates/`; the only `hooks.json` is ZCode's (`PreToolUse`/`PostToolUse`/`Stop` + `gate.mjs`), and `templates/docs/opencode.jsonc` carries the deny rules incl. `git push --force*`. So "no `.claude/` hook or permission configuration, no `PreToolUse` gate, no per-agent permission DSL" is exactly true, and the consequence it draws — kernel + pre-commit + generated CI (`arggon.yml`: `arggon init --no-commit` + `arggon validate --json`) are the whole enforcement path on that client — is correct and is the most useful sentence in the amendment. No session context hook: `hook("context", …)` + `ITEM_BLOCK_MAX_BYTES` exist only in `opencode/plugins/arggon/index.ts` (`:4791`, `:180`) ✓.

## 3. Amendment discipline — CONFIRMED
Net diff for the ADR is **62 insertions / 0 deletions** (`git diff --numstat`), pure addition at three anchors. Shape matches the repo idiom exactly: ADR 0019's `Amendment (2026-10-02, PR #568)` frontmatter bullet plus blockquote amendments, and ADR 0018's PR #544 — including the 2-space-indented `> Amendment` nested inside a `## Consequences` list item, which is verbatim ADR 0018's pattern. `- Status: Accepted` (line 3), the `# 0020` heading and the filename are untouched; the original sentences ("Claude Code has only a `CLAUDE.md` pointer" line 16, "today it remains docs + `CLAUDE.md`" line 59) remain readable as taken. The second commit is a genuine 4-for-4-line reflow to stamp the PR number, so "62/0 plus a 4-line reflow" is precise, not a euphemism.

## 4. Impact class: Advisory — I agree, on the merits not just the letter
The rule (`agents.md` §Changing the methodology itself, line 471) triggers on carriers `agents.md`, `engineering.md`, `convention.md`, `skills/arggon-cli/**`; none is touched. Behavioral is defined as "a rule, a gate, a command contract, a pipeline step" — none changes. The decisive argument is stronger than the trigger test: **the corrected fact is already in the carriers** (§MCP server and §OpenCode V2 both say the generated `.mcp.json` serves Claude Code), so no agent has anything to re-learn — the ADR was the sole outlier, and this PR strictly reduces the repo's count of false statements. The nine-vs-fifteen split inside `agents.md` is **pre-existing** (§MCP server "nine" vs §OpenCode V2/ZCode "fifteen"), so this PR adds no new cross-doc contradiction; it aligns the ADR with the accurate half of a carrier that was already self-contradictory. No adopter artifact changes and no adopter action is owed — which is exactly what the ADR 0016 channel exists to say, so the escalation is genuinely unnecessary rather than merely waived. The class is also stated where the rule asks for it (PR description + item), satisfying ADR 0020 §Consequences on its own terms.

## 5. What it reported rather than fixed — all three calls are right
- `agents.md` §MCP server "as **nine** tools" while the shipped surface is fifteen and `:586` in the branch tree says "fifteen-tool": real, confirmed; that paragraph's Claude characterization is correct so only the count is stale; carrier text means a Behavioral-class edit with its own classification. Correct to file (`bug-agents-md-says-nine-mcp-tools`) rather than grow a docs-only ADR diff.
- `skills/arggon-cli/references/json-contract.md` §MCP surface: confirmed verbatim — "For clients with no code-mode tool API (ZCode, ADR 0014) it IS the native tool surface. **Fifteen tools**", Claude Code unnamed in a sentence that is true for it too. Correctly filed, and the worker correctly noted that a fix there owes a `.agents/skills/` mirror refresh + `npm run skills:sync`.
- `exploration-…-018.md:55` "Minimal: root `CLAUDE.md` pointer + shared skill copy" left as written: **right call.** It is the dated `Input:` record this ADR cites; rewriting it would falsify the input the decision was taken against, and the file is explicitly stamped "dated sources, accessed 2026-10-02". The ADR is where corrections belong.

## 6. ADR index parity — structurally guaranteed, not merely observed
Read `cli/src/adr-index-parity.test.ts`: it reads only the ADR directory listing, each file's `- Status:` line (regex `^-\s*\*{0,2}Status\*{0,2}:\s*(.+)$`), each file's `# NNNN` heading, and the index rows. This diff adds no file, renames nothing, changes no heading, and adds no column-0 `- Status:`-shaped line — the only added column-0 bullet begins `- Amendment (2026-10-02, PR #610):`, which that regex cannot match; the §Consequences amendment is a `  >` blockquote inside an existing list item. `docs/adr/README.md` correctly untouched (0020 row still `Accepted`). Confirmed in CI too: head run `37093010908` logs `✓ cli/src/adr-index-parity.test.ts (7 tests) 15ms` inside `Test Files 122 passed (122)` / `Tests 2275 passed (2275)`. No future obligation is created beyond the standing one the test already enforces. Also checked the other ADR-touching suites for exposure: `spec-doc-numbers.test.ts` is fixture-driven and keys on filenames, `spec-decision-gaps.test.ts` uses inline strings/fixtures, `adopt.test.ts` writes its own temp ADR dirs; `ui-smoke` is board/TUI only.

## Findings (severity order — none blocking)

**F1 (low, evidence bookkeeping — correct it before merge or in the handoff record).** The CI attribution I was handed does not match the logs. Run `37097542576` is on branch `feat/task-cli-start-remediation-tail-clipped-on-human-channel`, not this PR. PR #610's own failing run is `37092949358` (commit `1f6ea622c`), and it failed in `cli/src/cli.test.ts` — not `mcp-parity`:
```
FAIL cli/src/cli.test.ts > CLI --json > arggon start --worktree refuses a fresh worktree whose stale install cannot provide the declared bin
SpawnHarnessError: [arggon-test-spawn] CLI spawn produced no result
kind: child-boot-failed (no CLI result — this is not an assertion failure)
SyntaxError: The requested module './convention.js' does not provide an export named 'CONVENTION_VERSION_DEFAULT'
  at lib/dist/json.js:1   (1 failed | 2274 passed of 2275)
```
That is a stale/partial `lib/dist` build-artifact race inside CI — the harness itself classifies it as not an assertion failure. It cannot be caused by a markdown ADR, and the merge-blocking evidence is green regardless: **head `b980a0d0b` → run `37093010908` `cli` pass (5m48s) + `ui-smoke` pass, plus `tasks-validate` `37093010821` pass** (read from GitHub, not taken on trust). But `bug-mcp-parity-branch-test-json-parse-of-human-stdout` should not be cited as the owner of this failure, and per AGENTS.md a finding absorbed under the wrong id is a finding that gets lost: the `lib/dist` boot race deserves its own item (or an existing build-race one) rather than riding on the mcp-parity id.

**F2 (nit, evidence hygiene — ironic in this item).** The PR body and item body cite `docs/agents.md:557` and `:586`. Those were **correct when measured** (I checked the branch blob: 557 = the §OpenCode V2 paragraph, 586 = the ZCode fifteen-tool paragraph); main has since gained 11 lines in that file, so they now read 568/597. Harmless, and a good illustration of why the ADR itself cites section names rather than line numbers — the PR body should do the same, since it outlives the branch.

**F3 (nit).** The frontmatter Amendment bullet says "An `arggon init` tree already hands a Claude Code client two destinations" without the selection qualifier — `.mcp.json` is generated only when the `claude` seam is selected (`--no-agents` or `--agents` without `claude` yields none). The §Context amendment states this precisely ("of the **`claude` seam**"), so the record is correct where it counts; consider adding "(whenever the `claude` seam is selected)" to the summary bullet.

**F4 (nit).** The amendment cites `agents.md` §MCP server as support while that paragraph is the one carrying the stale "nine". A reader following the citation hits the wrong count until `bug-agents-md-says-nine-mcp-tools` lands. Citing the bug id in the amendment header would make the dependency visible in the record rather than only on the item (ADR 0018 has the precedent: it names `bug-seam-drift-gate-…` in an amendment header).

## Smoke
Docs-only → exempt (`engineering.md` "Smoke test" + the testing table). Correctly claimed; no CLI/UI/TUI change, so no probe is owed.

## Probes needed
None. Nothing in this verdict depends on execution evidence: the gate evidence I relied on is the CI run log for the PR head, which I read directly, and every substantive claim was settled by reading the shipped code the amendment cites.

## Recommendation
**Merge.** Two files, strictly additive, sourced to shipped code, correct about both the delivery and the gaps, ADR discipline intact, parity guaranteed, impact class right. Fix F1's bookkeeping before or alongside the merge; F2–F4 are optional polish for a follow-up. Item can go `done` after merge.
