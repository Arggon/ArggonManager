---
type: bug
status: in_progress
id: bug-mcp-server-binds-session-cwd-tracker-root
title: "`arggon mcp` binds the whole session to the server's launch cwd — every tool call resolves the tracker root from it, never from the item's `worktree_path`, so a maker's comment/handoff/update lands in the wrong tree"
assignee: arggon-delivery-lead
branch: fix/bug-mcp-server-binds-session-cwd-tracker-root
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [tooling, mcp]
created: "2026-10-11"
updated: "2026-10-15"
claimed_at: "2026-10-15T15:03:26.369Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-mcp-server-binds-session-cwd-tracker-root
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-mcp-server-binds-session-cwd-tracker-root.md
  Leaves live only under a story. id is the filename stem: bug-mcp-server-binds-session-cwd-tracker-root.
  CLI `arggon create bug mcp-server-binds-session-cwd-tracker-root` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `arggon mcp` binds the whole session to the server's launch cwd — every tool call resolves the tracker root from it, never from the item's `worktree_path`, so a maker's comment/handoff/update lands in the wrong tree

## Context

Filed from the done-gate maker's report (PR #713), who hit it live: `arggon mcp` binds the whole session to one tree (`runMcpServer({ cwd: process.cwd() })` in `cli/src/cli.ts`) and every tool call passes that same `cwd` down, so `arggon_comment` / `arggon_handoff` / `arggon_update` resolve the tracker root from the MCP SERVER's launch directory — never from the item's `worktree_path` frontmatter they already read. In that session the comment + handoff landed in the primary checkout on a stale `main` (item still `status: todo`, handoff recording `branch: main`), creating two local-only commits duplicating content already on the fix branch; the recovery was manual.

This is the same class as the DONE `bug-native-arggon-tools-resolve-tracker-root-to-session-cwd` — that item covered the native surface via the process cwd (session_move does not rebind). This item is the MCP entry point of the same coupling. The dangerous half: on `arggon_update --status done` the same cwd mix-up would flip (or refuse to flip) an item in a tree the branch is not on — the auto-done wedge class, reachable through a second door.

Three candidate repairs were proposed by the maker (written up at https://github.com/Arggon/ArggonManager/pull/713#issuecomment-6110626842): route through `worktree_path`; resolve per call; or refuse rather than write cross-tree.

## Acceptance

- [ ] The defect is reproduced from the MCP surface (stdio JSON-RPC in a scratch tracker is the established pattern — see PR #713's verification)
- [ ] One of the three repairs is chosen and implemented, with the reason recorded (refusing to write cross-tree is acceptable and minimal)
- [ ] A regression test pins: a comment/handoff/update for an item whose `worktree_path` is another tree either lands in that tree or fails named — never writes into the launching tree
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok

## Notes

### 2026-10-11 @arggon-delivery-lead

### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** Filed from the done-gate maker's report (PR #713), who hit it live: `arggon mcp` binds the whole session to one tree (`runMcpServer({ cwd: process.cwd() })` in `cli/src/cli.ts`) and every tool call passes that same `cwd` down, so `arggon_comment` / `arggon_handoff` / `arggon_update` resolve the tracker root from the MCP SERVER's launch directory — never from the item's `worktree_path` frontmatter they already read. In that session the comment + handoff landed in the primary checkout on a stale `main` (item still `status: todo`, handoff recording `branch: main`), creating two local-only commits duplicating content already on the fix branch; the recovery was manual.

This is the same class as the DONE `bug-native-arggon-tools-resolve-tracker-root-to-session-cwd` — that item covered the native surface via the process cwd (session_move does not rebind). This item is the MCP entry point of the same coupling. The dangerous half: on `arggon_update --status done` the same cwd mix-up would flip (or refuse to flip) an item in a tree the branch is not on — the auto-done wedge class, reachable through a second door.

Three candidate repairs were proposed by the maker (written up at https://github.com/Arggon/ArggonManager/pull/713#issuecomment-6110626842): route through `worktree_path`; resolve per call; or refuse rather than write cross-tree.

Acceptance:

- [ ] The defect is reproduced from the MCP surface (stdio JSON-RPC in a scratch tracker is the established pattern — see PR #713's verification)
- [ ] One of the three repairs is chosen and implemented, with the reason recorded (refusing to write cross-tree is acceptable and minimal)
- [ ] A regression test pins: a comment/handoff/update for an item whose `worktree_path` is another tree either lands in that tree or fails named — never writes into the launching tree
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok

### 2026-10-15 @Arggon
PR #846 (branch fix/bug-mcp-server-binds-session-cwd-tracker-root). Impact class: Behavioral (agents.md + arggon-cli skill are methodology carriers).

REPRO (MCP surface, before the fix) — real `arggon mcp` over stdio JSON-RPC, server launched from the primary of a scratch git repo whose item was claimed through `start --worktree`:
- expected: comment/handoff land in the claim worktree (worktree_path tree).
- observed: envelopes `ok: true` with `path: <primary>/ArggonManager/.../task-thing.md`; handoff recorded `branch: master`; two local-only commits on the primary's base branch; the worktree copy untouched. (`arggon_update --status done` rode the same door.)

REPAIR — route through the item's `worktree_path` (the lead's steer), new `cli/src/mcp-routing.ts`: item-addressed tools (update/comment/handoff/show) resolve per call from the launch copy's own `worktree_path`, else the sibling worktrees' claim footprints (`.arggon.env` or their item copy). A write whose recorded claim tree is gone/not-a-tracker refuses with `error.code: "TRACKER_ROOT_MISMATCH"` (the native surface's code) naming both trees + remedies — never falls back to the launching tree; reads never refuse. Pool calls and start/branch/cleanup untouched; CLI stays unrouted by design. Boundary recorded in the module doc: a branch claim with no worktree records no worktree_path, so it has no address to route through.

REPRO (after the fix) — same script: comment + handoff land in the worktree copy, handoff records `branch: feat/task-thing`, commits ride the claim branch, primary `git status` clean.

REGRESSION — cli/src/mcp-routing.test.ts (10) + the mcp-server.test.ts block end-to-end over the in-process stdio server: comment/handoff/`update --status done` land in the claim worktree, launching tree byte-unchanged; `show` reads the claim copy; a gone worktree fails named with nothing written; a plain tree keeps the old behavior.

GATES (worktree, expected → observed): `arggon validate` ok → ok (0 warnings) · MCP suites 90/90 → passed · `npm test` → 3581/3581 passed · `npm run lint` → clean · `npm run test:structure` → exit 0 · `prettier --check` on touched files → clean · `npm run check:plugin` → exit 0 (bundle byte-unchanged; the native surface needed no edit). Note: two intermediate full-suite runs hit a 30s timeout in prose-format.test.ts under this box's load average ~20 (pristine main isolation baseline for that file: 45s); the final full run is green.
