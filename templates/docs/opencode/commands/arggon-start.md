---
description: Claim an item and start work in its own git worktree
---

Start work on $ARGUMENTS following the ArggonManager rules:

1. Resolve the item id and confirm it is claimable (`arggon_next` /
   `arggon_show`); never steal a claim and never reopen `done`/`cancelled`.
2. Run `arggon start <id> --worktree --assignee <login>` (CLI) so claim,
   branch, worktree, commit and push happen in one flow. Add `--open-pr` only
   when a draft PR is wanted immediately.
3. Move this session into the worktree recorded on the item (`arggon_show <id>
   --json` → `worktree_path`) with the `opencode` session_move tool, so every
   later command runs there.
4. Load the `arggon-cli` skill if it is not loaded, then report the branch, the
   worktree path and the PR URL.
