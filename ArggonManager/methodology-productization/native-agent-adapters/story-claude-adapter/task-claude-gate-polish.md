---
type: task
status: in_progress
id: task-claude-gate-polish
title: "Claude seam: gate wording for argon_handoff + narrower PreToolUse matcher (post-#821 standards nits)"
assignee: arggon-delivery-lead
branch: feat/task-claude-gate-polish
parent: story-claude-adapter
labels: []
created: "2026-10-14"
updated: "2026-10-14"
claimed_at: "2026-10-14T20:08:15.698Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-claude-gate-polish
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-claude-adapter/task-claude-gate-polish.md
  Leaves live only under a story. id is the filename stem: task-claude-gate-polish.
  CLI `arggon create task claude-gate-polish` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Claude seam: gate wording for argon_handoff + narrower PreToolUse matcher (post-#821 standards nits)

## Context

The PR #821 standards pass (`task-claude-plugin-seam`) returned no blockers and no
should-fix items; two optional nits are actionable and tracked here so they are not lost:

1. **`arggon_handoff` is a tracker-append mutation the gate neither denies nor lists as an
   exception.** `templates/docs/claude/arggon/hooks/gate.mjs` denies the mutating MCP set
   (`arggon_create/update/start/branch/cleanup/priority/sync/import_issues`) and its header
   names only `arggon_comment` as open; `arggon_handoff` (a handoff comment append) sits in
   neither list, exactly like the ZCode gate. Exposure is nil today — the reviewer agent's
   allowlist grants neither handler — but spec 024 §Hook gates reads broader ("the mutating
   `mcp__arggon__*` tools"), so the wording/decision gap should close deliberately.
2. **The PreToolUse matcher is broader than needed.** `hooks.json` matches `mcp__.*`, so every
   unrelated MCP tool call in a session spawns the gate; the two arggon registration prefixes
   (`mcp__arggon__` + `mcp__plugin_arggon_arggon__`) are the whole set the gate can deny.

Recorded, not actioned here (context from the same pass): the repo-self marker-loss durability
gap (pre-existing across seams — the parity test compares marker-stripped bytes, so an absent
marker still passes), two expectations that re-derive from the same classifier (mitigated by the
literal `TIER1_DOCS` list), and one historical comment's file count.

## Acceptance

- [ ] The gate's deny set and its header state the same, complete rule: decide whether `arggon_handoff` is denied with the other mutating MCP tools or explicitly allowed as a verdict/read channel — implement the decision in `hooks/gate.mjs` and pin it in `cli/src/init-claude.test.ts` (a test that fails if the tool silently moves between the two sides)
- [ ] `hooks.json` PreToolUse matcher narrows from `mcp__.*` to the two arggon registration prefixes (bare + plugin-scoped), with a test pinning both prefixes in the matcher
- [ ] The seam README and the gate header name the same deny set the matcher/script implement
- [ ] `arggon validate`, the focused suite and prettier green; the decision recorded on the item (why denied or allowed), since it changes the backstop's documented surface

## Notes

- Optional polish from the #821 standards pass; no user-visible defect today. This bundle is a
  port of the ZCode gate — if the decision diverges from ZCode, record why.

### 2026-10-14 @Arggon
### task-claude-gate-polish — maker evidence (PR #823)

Branch `feat/task-claude-gate-polish`, commit `f23d8372`; pushed; PR https://github.com/Arggon/ArggonManager/pull/823.

**Decision taken: `arggon_handoff` is DENIED** with the mutating MCP set (both `mcp__arggon__*` and `mcp__plugin_arggon_arggon__*`), not allowed as a verdict/read channel. Rationale: spec 024 §Hook gates denies "the mutating `mcp__arggon__*` tools" and names `arggon_comment` as the one exception; a handoff appends a section to an item body, i.e. a tracker mutation. The full MCP surface was re-checked for completeness: branch/cleanup/create/handoff/import_issues/priority/start/sync/update are all denied; comment (verdict channel), list/next/report/show/validate stay open.

**Divergence from ZCode (candidate follow-up, NOT actioned here):** `templates/docs/zcode/arggon/hooks/gate.mjs` lists full-prefixed tool names and leaves `arggon_handoff` unlisted — neither denied nor explicitly allowed. That seam is untouched in this PR; the divergence is stated in the Claude gate header and in the README port notes, and the ZCode change is left for the delivery lead to route.

**Matcher narrowing:** `hooks.json` PreToolUse goes from `^(Bash|Write|Edit|MultiEdit|NotebookEdit|mcp__.*)$` to `^(Bash|Write|Edit|MultiEdit|NotebookEdit|mcp__arggon__.*|mcp__plugin_arggon_arggon__.*)$`; the five non-MCP tools stay, both arggon prefixes are pinned in the test.

**Repo self:** refreshed with `npm run arggon -- init . --agents claude --no-commit` (T1 flow). `git status` stayed limited to `.claude-marketplace/**` (3 files) + `ArggonManager/.convention.yml` (3 checksums moved + the run's generatedAt rows) + the two authored template files + the test.

**Gates (worktree, all green):**
- `npm run arggon -- validate` → ok, 0 warnings, convention v5 (native `tools.arggon.validate` also ok before the commit)
- `npx vitest run cli/src/init-claude.test.ts cli/src/adapter-selection.test.ts` → 2 files, 69 passed (26 in init-claude, incl. the two new pins)
- `npm test` → 158 files, 3459 passed. First run failed only `cli/src/headless-ci.test.ts` with "run `npm run build` first" (fresh worktree has no `dist/`); after `npm run build` the full suite is green.
- `npm run lint` → clean; `npm run test:structure` → 5 passed
- `npx prettier --check` on the authored files → clean. The generated `.claude-marketplace/arggon/README.md` is flagged for the marker-line/heading adjacency, but it is flagged identically at `HEAD` (verified against `git show HEAD:…`) and reformatting it would break the template parity test — committed exactly as `init` wrote it.

**Residual observed, not actioned (out of this item's scope):** the reviewer window's shell route (`MUTATING_ARGGON_WORDS`) still does not list `handoff` (nor `comment`, deliberately), so `npm run arggon -- handoff …` via Bash is not denied while the MCP tool now is. Same asymmetry exists on the ZCode seam. Flagged for the delivery lead rather than grown into this diff.

### handoff 2026-10-14 @Arggon — next: Delivery lead: review PR #823 (merge is yours); if approved, route the two recorded follow-ups (ZCode gate handoff parity; shell-route handoff asymmetry) as their own items — none were filed by the m…
- branch: feat/task-claude-gate-polish
- open questions: ZCode seam gate leaves arggon_handoff unlisted — port the deny decision there? (candidate follow-up, not filed); shell route MUTATING_ARGGON_WORDS still allows 'arggon handoff' via Bash while the MCP…

### 2026-10-14 @Arggon
### task-claude-gate-polish — review round 1 applied (PR #823)

**Must-fix taken: the shell route now matches the MCP decision.** Commit `b81aa04a`, pushed to `feat/task-claude-gate-polish`.

- `MUTATING_ARGGON_WORDS` in `templates/docs/claude/arggon/hooks/gate.mjs` gains `handoff`; `comment` stays out on this route too (verdict channel open on both routes).
- Gate header + README §Hook gates/port notes now state the shell route explicitly (denied words include `handoff`; `comment` open) and the ZCode divergence note covers **both** routes (ZCode leaves `arggon_handoff` unlisted on MCP and shell; that seam remains untouched).
- `cli/src/init-claude.test.ts` reviewer-window shell test now pins `arggon handoff task-x --next ship-it`, `sh -c "arggon handoff task-x"` and `npm run arggon -- handoff task-x` as denied, and `npm run arggon -- comment task-x "handoff context: …"` as allowed — moving the word back out fails the suite.
- Repo self refreshed again: `npm run arggon -- init . --agents claude --no-commit` → `.claude-marketplace/arggon/{hooks/gate.mjs,README.md}` + `ArggonManager/.convention.yml` (2 checksums moved).

**Gates (worktree, all green):** `npm run arggon -- validate` ok (0 warnings); focused `npx vitest run cli/src/init-claude.test.ts cli/src/adapter-selection.test.ts` → 69 passed; `npm test` → 3459 passed; `npm run lint` clean; `npm run test:structure` 5 passed; `npx prettier --check` clean on the touched authored files (the generated repo-self README keeps its pre-existing marker-adjacency flag, unchanged from HEAD).
