# Agent playbook (v0)

Humans and agents follow the **same** rules. Work lives in git under `tasks/` — see [`docs/convention.md`](./convention.md). This playbook is the short loop: find → claim → work → update → PR.

## Prerequisites

- Node.js 22.12+ and a checkout of the target repo (with `tasks/` already initialized, or run `arggon init`).
- From the ArggonManager package root (or a linked `arggon` binary):

- `npm install`
- `npm run arggon -- <command>`

## 0. Issue tracking: `tasks/`, not GitHub issues

All work — features, tasks, bugs, review follow-ups — is tracked as work items under **`tasks/`** via `arggon create`, **not** as GitHub issues. GitHub is for **PRs only**.

- File findings where they are found: `npm run arggon -- create bug "<title>" --parent <story-id>` (bugs/tasks live only under a story; create the story/epic/initiative chain if the area has none yet).
- **Comments are the agent handoff channel.** When you stop work (blocked, done, or handing off), leave context on the item itself: `arggon comment <id> "why blocked / what the next agent should know"` appends a timestamped, author-attributed section to the item body. Body-only write (frontmatter, including `updated`, is never touched); allowed on `done`/`cancelled` items — a comment is history, not a reopen.
- **Consolidate review findings into follow-ups.** Every actionable finding from a code review, audit, or incident (PR review comments, review summaries, post-merge observations) MUST be filed as a `task`/`bug` under the story that owns the affected area, with context (links to the PR/comment) and an acceptance checklist in the body. Do this **before the reviewed PR merges, or immediately after** — a PR comment alone is not tracking and gets lost. If no story covers the area, create one under the matching epic first.
- Reference the item id in the PR description; move the item to `done` only when the PR fully finishes it.
- Do **not** open new GitHub issues. Pre-existing GitHub issues migrate into `tasks/` with `arggon import-issues` (one-shot and idempotent; `--dry-run` previews the mapping), then close on GitHub with a pointer to the item.

## 1. Find open work

Prefer machine-readable list output:

- `npm run arggon -- list --status todo --json`
- `npm run arggon -- list --status todo --type task --json`
- `npm run arggon -- list --assignee @me --json`

Human table (no `--json`) is fine for a quick scan. Filter with `--type` / `--status` / `--assignee` as needed.

Pick a **claimable** item: `story`, `task`, or `bug` in `todo` (or return to `in_progress` only if you already own it).

## 2. Claim

**Claim** (convention v0) = claimable type + non-null `assignee` + `status: in_progress`.

- `npm run arggon -- update <id> --status in_progress --assignee <github-login>`

If another assignee already holds the claim, `update` refuses the reassignment (claim conflict) unless `--force` — do not force; see [`docs/claim.md`](./claim.md). Prefer a different item or coordinate in the issue/PR. Claims carry a soft lease (`claimed_at`): `arggon list --stale --older-than 7d` reports stale claims, and reclaiming one is a **human-only** `update <id> --steal --reason "..." --assignee <you>` — agents are never allowed to steal.

Rules:

- Do **not** set `in_progress` on a claimable item without `assignee` (`update` enforces this).
- Initiative/epic may be `in_progress` without assignee (container status only).

## 3. Create bugs/tasks from findings

When work reveals new work, create items under the correct parent story — this is the issue tracker (see §0); do not file GitHub issues:

- `npm run arggon -- create task "Add rate limiting" --parent story-login`
- `npm run arggon -- create bug "Login 500 on empty password" --parent story-login`
- `npm run arggon -- create task "..." --parent <story-id> --json`

Defaults: `status: todo`, quoted `YYYY-MM-DD` timestamps, omit `assignee` when unassigned. Leave new items `todo` unless you claim them immediately.

## 4. Branch naming

Generate the branch from the work item `id` following the configured patterns (`tasks/.convention.yml`, `branch_patterns`):

- `npm run arggon -- branch <id>`

This checks out the branch and records it in the item's `branch` field. If the right branch already exists and matches, it attaches to it. Defaults follow `feat/<id>` / `fix/<id>` / `docs/<id>` (e.g. `feat/task-rate-limit`, `fix/bug-empty-password-500`).

The manual worktree step (`git worktree add ../<repo>-<id> -b <branch>`) can be folded into the claim: `arggon start <id> --worktree --assignee <login>` claims, creates (or attaches to) the worktree at `../<repo-name>-<id>`, and runs the claim commit / push / optional `--open-pr` inside it, recording the path on the item's `worktree_path` field. When the work is done and merged, `arggon cleanup` lists (and with `--prune` removes) the stale worktrees.

One primary claimable id per branch when possible. Open a PR early; keep it small.

## 5. Done criteria

An item is **done** when:

1. Acceptance checklist in the Markdown body is complete (or explicitly waived in Notes with rationale).
2. Frontmatter `status` is `done` via `arggon update <id> --status done`.
3. `updated` date is refreshed (`arggon update` does this automatically).
4. The PR referencing the work item id is merged (or the completing change is on the default branch).

Do **not** jump `todo` → `done` — claim first (`in_progress`), then complete.

**Automatic container completion:** updates that reach a terminal state (`done`/`cancelled`) auto-complete any ancestor container whose entire subtree is terminal (up to the initiative; see the exception in `docs/convention.md`). Use `--no-cascade` when ancestors must not be touched.

### Auto-done on merge

The `auto-done` workflow (`.github/workflows/auto-done.yml`) mirrors `start` on the done side: when a PR referencing `task-*`/`bug-*` ids merges into `main`, it flips claimed items to `done` through `arggon update`, runs the test suite on the flip tree, and lands the change as a squashed `github-actions[bot]` PR (the workflow posts the required `cli` check on the flip commit itself — bot pushes/PRs don't trigger CI). Limits you must still cover yourself:

- It only performs the legal `in_progress` → `done` transition. Items still `todo` or `blocked` when the PR merges are skipped with a warning annotation — claim before merging, or mark them manually.
- It never edits acceptance checklists and never touches containers (story/epic/initiative) — tick the checklist in the item body before the PR merges.
- Reference the item id in the PR title or body (the id is what the workflow greps for).

### Blocked

Set `status: blocked`, keep `assignee` on claimable types, and set non-empty `blocked_reason` per convention:

```bash
arggon update <id> --status blocked --blocked-reason "Waiting on OAuth app credentials"
```

### Unclaim

`in_progress` → `todo` clears `assignee` (v0). Prefer that over leaving a stale claim:

```bash
arggon update <id> --status todo
```

### Reopen

Agents **MUST NOT** reopen `done` / `cancelled` (the schema allows `→ todo`; the playbook forbids it for agents). Humans may reopen with `arggon update <id> --status todo`.

## JSON for agents

Pass `--json` on supported commands for a stable object on stdout (see [`docs/json-output.md`](./json-output.md)). On failure, expect non-zero exit and a JSON error object when `--json` was set.

## MCP server

`arggon mcp` starts a stdio MCP (JSON-RPC 2.0, newline-delimited) server that exposes the same kernel as four tools: `arggon_list`, `arggon_create`, `arggon_update`, and `arggon_comment`. Tool results are the documented `--json` envelope objects (see [`docs/json-output.md`](./json-output.md)) serialized as text content; kernel failures surface as tool errors with the CLI's message text.

The MCP layer always calls the kernel with the agent playbook rules applied: an MCP caller cannot reopen `done`/`cancelled` items and cannot steal a claim (there is no `force` parameter). These rules live in one module (`cli/src/rules.ts`) shared by the CLI and the MCP server, so both entry points enforce identical semantics.

Wire it up with any MCP client config:

```json
{
  "command": "arggon",
  "args": ["mcp"]
}
```

## Documentation maintenance (docs, ADRs, specs, plans)

Agents and humans keep the docs alive **in the same PR as the change** — never as a TODO, a review comment, or a follow-up that blocks release.

### What to update, by change type

| Change | Update (same PR) |
| --- | --- |
| New or changed CLI command / flag | `README.md` (user-facing section) **and** `docs/json-output.md` (payload section + the `command` enum in the envelope table) |
| JSON contract field or shape | `docs/json-output.md` (`WorkItem` table or the command section). Additive fields note their additivity; breaking changes bump `schemaVersion` |
| Task-tree / frontmatter / validate behavior | `docs/convention.md` — non-negotiable, see the review bar in `docs/engineering.md` |
| Cross-cutting decision (stack, identity, schema model, new top-level package) | ADR under `docs/adr/` — see the ADR process in `docs/engineering.md` (4-digit id, `Proposed` in the PR, `Accepted` on merge, supersede instead of rewriting) |
| Non-trivial feature worth design review | Spec in `docs/specs/` + implementation plan in `docs/plans/` (see below) |
| Agent playbook rules themselves | This file (`docs/agents.md`) |

### Specs and plans (for non-trivial features)

- **Spec** (`docs/specs/spec-<slug>-NNN.md`): the reviewable contract — purpose, synopsis, flags, JSON shapes, invariants ("never overwrites", "pure read"), and acceptance criteria. Write it **before** implementing; frontmatter carries `spec_id`, `title`, `status` (`proposed` → `implemented`), `created`.
- **Plan** (`docs/plans/plan-<slug>-NNN.md`): the implementation breakdown derived from the spec — ordered tasks, each with verifiable acceptance criteria and a link back to the spec. Frontmatter: `plan_id`, `spec`, `status`.
- When the feature lands, flip both statuses in the same PR as the implementation (never leave a shipped feature `proposed`).

### Verification before opening the PR

- `grep` the new command/flag/field across `README.md`, `docs/json-output.md`, `docs/convention.md`, `docs/agents.md` — every hit must match the implemented behavior.
- `arggon validate` passes.
- If the change made any doc statement false, that doc edit belongs in this PR.

## Reference integrations

Copy-paste wiring so agents follow ArggonManager rules **by default** — same CLI, same rules, no private dialect (Phase 3, [#20](https://github.com/Arggon/ArggonManager/issues/20)).

Or print it on demand: `arggon instructions` extracts these snippets from this file at runtime (`--json` emits them as structured fields), so doc and command cannot drift.

### Pre-commit gate

`.git/hooks/pre-commit` (make executable) — rejects commits with invalid frontmatter or tree:

```sh
#!/bin/sh
npm run arggon -- validate
```

### CI gate

Add a job to your workflow (mirrors this repo's `.github/workflows/ci.yml`):

```yaml
tasks-validate:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
    - run: npm ci
    - run: npm run arggon -- validate
```

### Agent instructions snippet

Paste into the target repo's `AGENTS.md` (or equivalent) so coding agents loop through the CLI:

```markdown
## Task workflow (ArggonManager)

Work items live under tasks/ — see docs/convention.md and docs/agents.md.

1. Find work: `npm run arggon -- list --status todo --json`
2. Claim before starting: `npm run arggon -- update <id> --status in_progress --assignee <your-login>`
3. Branch `feat/<id>` / `fix/<id>`; one claimed item per branch.
4. Never steal a claim; if taken, pick another item or coordinate.
5. Create follow-up work with `arggon create task|bug "<title>" --parent <story-id>`.
6. Done = acceptance checklist complete + `arggon update <id> --status done` + PR linked.
7. Never reopen done/cancelled items.
```

## Related

- Convention: [`docs/convention.md`](./convention.md)
- Engineering: [`docs/engineering.md`](./engineering.md)
- Claim concurrency: [`docs/claim.md`](./claim.md)
- JSON contract: [`docs/json-output.md`](./json-output.md)
- Contributing: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
