# AGENTS.md

Agent rules for this repo live in [`docs/agents.md`](docs/agents.md) — read that first. The short version:

- **Issue management is in-tree, not GitHub.** Track all work (features, tasks, bugs, review follow-ups) as work items under `tasks/` via `npm run arggon -- create task|bug "<title>" --parent <story-id>`. Do **not** open GitHub issues; GitHub is for PRs only. This repo's own work lives under `tasks/arggon-manager/`.
- **Review findings become items, not comments.** Every actionable finding from a code review (PR review, audit, incident) MUST be consolidated as a follow-up `task`/`bug` under the right story via `arggon create` — with context and an acceptance checklist in the body — before the reviewed PR merges or immediately after. A PR comment alone is not tracking; unfiled findings get lost.
- Claim before starting: `npm run arggon -- update <id> --status in_progress --assignee <login>`. Never steal a claim.
- One branch per item: `npm run arggon -- branch <id>`; keep PRs small and reference the item id.
- **Always work in a git worktree.** Never switch branches in the primary checkout: create one per item with `git worktree add ../<repo>-<item-id> -b <branch>` (or `npm run arggon -- branch <id>` inside the new worktree) and do all edits, builds and commits there, so parallel agents/sessions on this repo never collide on the working tree.
- Done = acceptance checklist in the item body complete + `status: done` + PR merged (see [`docs/agents.md`](docs/agents.md) §5). Never reopen `done`/`cancelled` items.
