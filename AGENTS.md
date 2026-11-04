# AGENTS.md

Agent rules for this repo live in [`docs/agents.md`](ArggonManager/docs/agents.md) — read that first. The short version:

- **Issue management is in-tree, not GitHub.** Track all work (features, tasks, bugs, review follow-ups) as work items under the tracker root (`ArggonManager/`) via `npm run arggon -- create task|bug "<title>" --parent <story-id>`. Do **not** open GitHub issues; GitHub is for PRs only. This repo's own work lives under `ArggonManager/arggon-manager/`.
- **Review findings become items, not comments.** Every actionable finding from a code review (PR review, audit, incident) MUST be consolidated as a follow-up `task`/`bug` under the right story via `arggon create` — with context and an acceptance checklist in the body — before the reviewed PR merges or immediately after. A PR comment alone is not tracking; unfiled findings get lost.
- Claim before starting: follow the [canonical workflow contract](ArggonManager/docs/agents.md#canonical-workflow-contract) — agents claim through `npm run arggon -- start <id> --worktree --assignee <agent-id>` (native `tools.arggon.start({ id, assignee, worktree: true })`) and work in the recorded worktree. Never hand-roll `git worktree add` for a claim, use a bare `update` claim, or steal a claim.
- One branch per item; keep PRs small and reference the item id.
- **Always work in a git worktree.** Never switch branches in the primary checkout: work in the worktree your claim recorded on the item's `worktree_path`, and do all edits, builds and commits there, so parallel agents/sessions on this repo never collide on the working tree.
- Done = acceptance checklist in the item body complete **and the PR merged**; the maker never flips it. The delivery lead verifies the merge and flips `done`, or `auto-done` does after merge (see the contract and [`docs/agents.md`](ArggonManager/docs/agents.md) §5). Never reopen `done`/`cancelled` items.
