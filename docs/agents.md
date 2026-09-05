# Agent playbook (v0)

Humans and agents follow the **same** rules. Work lives in git under `tasks/` — see [`docs/convention.md`](./convention.md). This playbook is the short loop: find → claim → work → update → PR.

## Prerequisites

- Node.js 20+ and a checkout of the target repo (with `tasks/` already initialized, or run `arggon init`).
- From the ArggonManager package root (or a linked `arggon` binary):

- `npm install`
- `npm run arggon -- <command>`

## 1. Find open work

Prefer machine-readable list output:

- `npm run arggon -- list --status todo --json`
- `npm run arggon -- list --status todo --type task --json`
- `npm run arggon -- list --assignee @me --json`

Human table (no `--json`) is fine for a quick scan. Filter with `--type` / `--status` / `--assignee` as needed.

Pick a **claimable** item: `story`, `task`, or `bug` in `todo` (or return to `in_progress` only if you already own it).

## 2. Claim

**Claim** (convention v0) = claimable type + non-null `assignee` + `status: in_progress`.

When `arggon update` is available (#12):

- `npm run arggon -- update <id> --status in_progress --assignee <github-login>`

Until `update` ships, claim by editing the item's YAML frontmatter the same way (`status` + `assignee`), then commit on your branch.

Rules:

- Do **not** set `in_progress` on a claimable item without `assignee`.
- Initiative/epic may be `in_progress` without assignee (container status only).
- If another assignee already holds the claim, do **not** steal it — see concurrency (#16). Prefer a different item or coordinate in the issue/PR.

## 3. Create bugs/tasks from findings

When work reveals new work, create items under the correct parent story:

- `npm run arggon -- create task "Add rate limiting" --parent story-login`
- `npm run arggon -- create bug "Login 500 on empty password" --parent story-login`
- `npm run arggon -- create task "..." --parent <story-id> --json`

Defaults: `status: todo`, quoted `YYYY-MM-DD` timestamps, omit `assignee` when unassigned. Leave new items `todo` unless you claim them immediately.

## 4. Branch naming

Tie the branch to the work item `id`:

- `feat/<id>`
- `fix/<id>`
- `docs/<id>`

Examples: `feat/task-rate-limit`, `fix/bug-empty-password-500`.

One primary claimable id per branch when possible. Open a PR early; keep it small.

## 5. Done criteria

An item is **done** when:

1. Acceptance checklist in the Markdown body is complete (or explicitly waived in Notes with rationale).
2. Frontmatter `status` is `done` (via `arggon update` when available, else edit + commit).
3. `updated` date is refreshed (`YYYY-MM-DD`).
4. PR linked to the relevant GitHub issue(s) is merged (or the completing change is on the default branch).

Do **not** jump `todo` → `done` — claim first (`in_progress`), then complete.

### Blocked

Set `status: blocked`, keep `assignee` on claimable types, and set non-empty `blocked_reason` per convention. Prefer `arggon update` when it exists.

### Unclaim

`in_progress` → `todo` clears `assignee` (v0). Prefer that over leaving a stale claim.

### Reopen

Agents **MUST NOT** reopen `done` / `cancelled`. Humans may use a documented escape hatch when that lands (`arggon reopen` / `--force`).

## JSON for agents

Pass `--json` on supported commands for a stable object on stdout (see [`docs/json-output.md`](./json-output.md)). On failure, expect non-zero exit and a JSON error object when `--json` was set.

## Related

- Convention: [`docs/convention.md`](./convention.md)
- Engineering: [`docs/engineering.md`](./engineering.md)
- Claim concurrency: issue #16
- Contributing: [`CONTRIBUTING.md`](../CONTRIBUTING.md)

