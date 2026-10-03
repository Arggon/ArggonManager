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
