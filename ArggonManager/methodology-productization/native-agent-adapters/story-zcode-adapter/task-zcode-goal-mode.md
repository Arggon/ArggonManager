---
type: task
status: in_progress
id: task-zcode-goal-mode
title: ZCode goal-mode template from item checklist (plan T5)
assignee: Arggon
branch: feat/task-zcode-goal-mode
parent: story-zcode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T23:58:06.586Z"
depends_on: [task-adapter-selection-flags, task-capability-matrix]
worktree_path: /home/arggon/Projects/ArggonManager-task-zcode-goal-mode
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-zcode-adapter/task-zcode-goal-mode.md
  Leaves live only under a story. id is the filename stem: task-zcode-goal-mode.
  CLI `arggon create task zcode-goal-mode` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ZCode goal-mode template from item checklist (plan T5)

## Context

Generated goal-mode template: objective + verification contract derived from the claimed item's acceptance checklist; never spans worktrees

## Acceptance

- [x] template generation test
- [x] goal contract parses the checklist
- [x] documented: one goal per claimed item

## Notes

What landed (spec §S5, plan T5):

- **Generated template** `templates/docs/zcode/arggon/templates/goal-mode.md` →
  `.zcode-marketplace/arggon/templates/goal-mode.md` (tier-1, provenance +
  never-overwrite through the existing docs pipeline), plus the
  `/arggon-goal` command doc. Provenance + never-overwrite asserted in
  `cli/src/init-zcode.test.ts`.
- **Derivation** `cli/src/goal-mode.ts`: objective = the item's first
  _unchecked_ acceptance box (empty `- [ ]` skipped, same rule as the done
  gate); verification = every unchecked criterion, clipped (240 B objective,
  200 B/line, ≤ 8 inlined, overflow counted); no unchecked box → explicit
  "DEFINE THE GOAL FIRST" contract. Bounded prose/template reads, so a
  tampered or oversized item cannot produce an unbounded contract.
- **Boundaries appended by the CLI, not read from the template file**, so an
  adopter-edited copy cannot drop them: one goal per claimed item, one
  worktree per item, never another item's worktree, never steal/reopen, a
  reviewer dispatch stays read-only, kernel is the enforcement of record.
- **Refusals (no override flag)**: `GOAL_ITEM_CLOSED`, `GOAL_UNCLAIMED`,
  `GOAL_FOREIGN_CLAIM`, `GOAL_WORKTREE_MISMATCH`, `GOAL_WORKTREE_MISSING`,
  `GOAL_TEMPLATE_UNAVAILABLE`, `GOAL_FAILED`. Documented in
  `ArggonManager/docs/agents.md` §ZCode, README (`arggon goal`),
  `docs/json-output.md` (`goal`), skill `references/{json-contract,orchestration}.md`.
- **CLI surface**: `arggon goal <id> [--json]` (pure read, no lock/commit,
  no tracker auto-commit). Deliberately **no MCP tool** — it mutates nothing,
  so the fifteen-tool kernel surface is unchanged; the ZCode seam reaches it
  through the headless bin (the gate already treats `arggon …` shell
  invocations as the CLI path).

Gates: `npm run build`, `npm test` (2206 passed / 119 files), `npm run lint`,
`npm run arggon -- validate` (ok, convention v5), `npm run check:plugin`
(byte-identical). Spec/plan `status` left at `proposed` — S5's acceptance box
also covers the automations templates (sibling `task-zcode-automations`), so
it is not ticked by this item.

### 2026-10-03 @Arggon
## @Arggon — worker evidence (PR #605, branch feat/task-zcode-goal-mode)

Claim/worktree safety: all tracker writes routed through `npm run arggon -- …` with this
worktree as cwd; the native `tools.arggon.*` were not used for writes. Primary checkout
(`/home/arggon/Projects/ArggonManager`) verified on `main` @ 26c3b13b with a clean tree and
its own pre-claim copy of this item (status todo, no assignee) — none of this branch's
commits are in it (`git log --oneline origin/main..HEAD` = 2 commits, both on
feat/task-zcode-goal-mode).

### Expected vs observed (gates, post-rebase onto origin/main @ ba808947)

| gate | expected | observed |
| --- | --- | --- |
| `npm run build` | ok | ok (build:plugin 457609 bytes) |
| `npm test` | green | 120 files, 2229 passed (119/2206 before the rebase picked up main's new test file) |
| `npm run lint` | clean | clean |
| `npm run arggon -- validate` | ok | `arggon validate: ok (0 warning(s), convention v5)` |
| `npm run check:plugin` | bundle byte-identical | no diff |

### Behavior, live (from this worktree)

- `npm run arggon -- goal task-zcode-goal-mode` → objective `template generation test`,
  verification 1–3 = the three unchecked boxes, `## Boundaries (hard)` +
  `## Refusals (stop and report …)` appended, `Claim holder: Arggon`.
- same command with `--json` from the primary checkout →
  `{"ok":false,…,"error":{"code":"GOAL_UNCLAIMED"}}`, exit 1 (that checkout has no claim).

### Not done here (deliberate)

- No MCP tool for `goal`: it mutates nothing, so the fifteen-tool kernel surface stays as
  it is; the ZCode seam reaches the command through the headless bin. Flagging in case the
  reviewer wants an MCP wrapper instead — that would touch the tool-count docs
  (`agents.md`, `opencode2.md`, `json-contract.md`) and `mcp-parity`.
- Spec §S5 acceptance box also covers the automation templates (`task-zcode-automations`),
  so spec/plan `status` stays `proposed` and this box is not ticked.

### handoff 2026-10-03 @Arggon — next: review PR #605 (draft): goal-mode template + `arggon goal`; decide whether an MCP wrapper is wanted instead of the headless bin
- branch: feat/task-zcode-goal-mode
- open questions: MCP wrapper for goal? would touch the fifteen-tool surface docs; goal template location (plugin templates/ dir) unverified against live ZCode
