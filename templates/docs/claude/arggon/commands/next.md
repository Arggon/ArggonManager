---
description: Show the next claimable item and how to claim it
---

Use the arggon MCP tools (`mcp__arggon__*`) to find the next claimable item —
`mcp__arggon__arggon_next` with no arguments; pass `ready: true` to restrict the pool to
items whose dependencies are all terminal. $ARGUMENTS

Report, bounded: item id, title, priority, why it ranks first, its parent chain,
blocked-by/unblocks counts, and the exact claim step
(`mcp__arggon__arggon_start` with the assignee and `worktree: true`). Do not claim
anything without being asked.
