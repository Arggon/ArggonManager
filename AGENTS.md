# AGENTS.md

Agent rules for this repo live in [`docs/agents.md`](docs/agents.md) — read that first. The short version:

- **Issue management is in-tree, not GitHub.** Track all work (features, tasks, bugs, review follow-ups) as work items under `tasks/` via `npm run arggon -- create task|bug "<title>" --parent <story-id>`. Do **not** open GitHub issues; GitHub is for PRs only. This repo's own work lives under `tasks/arggon-manager/`.
- Claim before starting: `npm run arggon -- update <id> --status in_progress --assignee <login>`. Never steal a claim.
- One branch per item: `npm run arggon -- branch <id>`; keep PRs small and reference the item id.
- Done = acceptance checklist in the item body complete + `status: done` + PR merged (see [`docs/agents.md`](docs/agents.md) §5). Never reopen `done`/`cancelled` items.
