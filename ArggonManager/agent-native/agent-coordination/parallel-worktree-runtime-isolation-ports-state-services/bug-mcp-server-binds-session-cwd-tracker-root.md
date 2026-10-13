---
type: bug
status: todo
id: bug-mcp-server-binds-session-cwd-tracker-root
title: "`arggon mcp` binds the whole session to the server's launch cwd — every tool call resolves the tracker root from it, never from the item's `worktree_path`, so a maker's comment/handoff/update lands in the wrong tree"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [tooling, mcp]
created: "2026-10-11"
updated: "2026-10-11"
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
