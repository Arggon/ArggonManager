# AGENTS.md

Agent rules for this repo live in [`docs/agents.md`](ArggonManager/docs/agents.md) — read that first. The short version:

- **Issue management is in-tree, not GitHub.** Track all work (features, tasks, bugs, review follow-ups) as work items under the tracker root (`ArggonManager/`) via `npm run arggon -- create task|bug "<title>" --parent <story-id>`. Do **not** open GitHub issues; GitHub is for PRs only. This repo's own work lives under `ArggonManager/arggon-manager/`.
- **Review findings become items, not comments.** Every actionable finding from a code review (PR review, audit, incident) MUST be consolidated as a follow-up `task`/`bug` under the right story via `arggon create` — with context and an acceptance checklist in the body — before the reviewed PR merges or immediately after. A PR comment alone is not tracking; unfiled findings get lost.
- Claim before starting: `tools.arggon.start({ id, assignee: "<login>", worktree: true })` (`/arggon-start`, or `npm run arggon -- start <id> --worktree`) — the claim creates the worktree and records `branch` + `worktree_path`. Never hand-roll `git worktree add` for a claim and never steal one.
- One branch per item: `npm run arggon -- branch <id>`; keep PRs small and reference the item id.
- **Always work in a git worktree.** Never switch branches in the primary checkout: work in the worktree your claim recorded on the item's `worktree_path`, and do all edits, builds and commits there, so parallel agents/sessions on this repo never collide on the working tree.
- Done = acceptance checklist in the item body complete + `status: done` + PR merged (see [`docs/agents.md`](ArggonManager/docs/agents.md) §5). Never reopen `done`/`cancelled` items.
