---
description: Claim an item and start work in its own git worktree
---

Start work on $ARGUMENTS following the ArggonManager rules:

1. Resolve the item id and confirm it is claimable (`tools.arggon.next` /
   `tools.arggon.show`); never steal a claim and never reopen `done`/`cancelled`.
2. Claim it with the native tool:
   `tools.arggon.update({ id, status: "in_progress", assignee: "<login>" })`.
3. Create the branch and the item worktree with git
   (`git worktree add ../<repo>-<id> -b feat/<id>`), then record the branch on
   the item with `tools.arggon.update({ id, branch: "feat/<id>" })`.
4. Move this session into the worktree: read the item's recorded
   `worktree_path` with `tools.arggon.show({ id, meta: true })`, then call the
   `opencode` `session_move` tool — so every later command runs there.
5. Load the `arggon-cli` skill if it is not loaded, then report the branch, the
   worktree path and the item id.
