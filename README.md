# ArggonManager

**Git-native project management for builders and agents.**

Tasks live _inside_ the repository as Markdown. Create a file, open a branch, update YAML — the whole team (and any agent) stays in sync. No separate board to drift out of date.

> **Status:** early design — convention + CLI first.

## Demo

A 30-second tour — list, claim, create, finish, validate, board (autoplay below; also available as [MP4](docs/assets/arggon-demo.mp4)):

![ArggonManager demo](docs/assets/arggon-demo.gif)

**`arggon list`** — the whole plan, right from the repo:

![arggon list output](docs/assets/cli-list.png)

**`arggon create` / `arggon update`** — claim and move work by editing files:

![arggon create and update](docs/assets/cli-create-update.png)

**`arggon update --status done` + `arggon validate`** — finish work and verify the tree (CI-ready):

![arggon validate](docs/assets/cli-validate.png)

**`arggon board`** — a static, self-contained HTML snapshot of the same tree:

![arggon board](docs/assets/board.png)

## The idea

Work is a **folder tree** that mirrors Agile structure:

```text
tasks/
  <initiative>/
    <epic>/
      <story>/
        task-....md
        bug-....md
```

Each item is a Markdown file with **YAML frontmatter** (status and other fields). Updating work means editing the file and committing — same flow for developers, QA, and agents.

**Convention (v0) is locked.** See [`docs/convention.md`](docs/convention.md) for folder layout, frontmatter schema, statuses, and claim rules. A sample tree lives under [`tasks/launch-mvp/`](tasks/launch-mvp/) (plus [`tasks/.convention.yml`](tasks/.convention.yml)). Copy-paste templates for each type live in [`templates/`](templates/).

## Who it’s for

- Builders who want tasks next to the code
- Teams that share work through git, not a SaaS board
- Agents that should pick up and create tasks like humans

## Principles

1. **Repo is source of truth** — if it’s not in git, it isn’t the plan
2. **Files over forms** — an `.md` is the ticket
3. **Same rules for humans and agents**
4. **Simple & self-hostable** — open, lightweight, no lock-in

## What’s shipping (phased)

| Phase | Deliverable                                       |
| ----- | ------------------------------------------------- |
| **1** | Folder + frontmatter **convention** and templates |
| **1** | **CLI** to create, list, and update tasks         |
| **2** | Viewer / board UI over the tree                   |
| **3** | Agent hooks / SDK so agents follow the same rules |

## Example task file

```markdown
---
type: task
status: todo
id: task-rate-limit
parent: story-login
labels: [security]
created: "2026-09-03"
updated: "2026-09-03"
---

# Add login rate limiting

## Context

...

## Acceptance

- [ ] ...
```

Exact v0 fields are documented in [`docs/convention.md`](docs/convention.md) (layout, schema, and status transitions are locked). Omit `assignee` when unassigned (do not write an empty `assignee:`).

## Docs

- [Task convention](docs/convention.md) — folder layout, frontmatter schema, statuses (v0 locked)
- [Agent playbook](docs/agents.md) — find, claim, create, PR loop for humans and agents
- [Claim / concurrency](docs/claim.md) — claim definition, conflict/`--force`, unclaim recovery
- [Engineering conventions](docs/engineering.md) — repo structure, review bar, testing, ADRs (Phase 1)
- [Phase 2 viewer spike](docs/viewer-spike.md) — proposed constraints for board/viewer over `tasks/` (towards #19; not an ADR)
- Sample tree: [`tasks/launch-mvp/`](tasks/launch-mvp/)

## Templates

v0 stubs (YAML frontmatter + Context / Acceptance / Notes) live in [`templates/`](templates/):

- [`templates/initiative.md`](templates/initiative.md)
- [`templates/epic.md`](templates/epic.md)
- [`templates/story.md`](templates/story.md)
- [`templates/task.md`](templates/task.md)
- [`templates/bug.md`](templates/bug.md)
- [`templates/spec.md`](templates/spec.md) / [`templates/plan.md`](templates/plan.md) (rendered by `arggon spec new`)

Copy a stub into `tasks/` per [`docs/convention.md`](docs/convention.md), or use `arggon create` (copies from these templates). Spec/plan stubs are rendered into `docs/specs/` / `docs/plans/` by `arggon spec new` (see below).

## CLI (Phase 1)

Requires **Node.js 22.12+** (needed by vitest 5 in the dev toolchain; `engines` enforces it). Stack: [docs/adr/0001-cli-stack.md](docs/adr/0001-cli-stack.md) (ADR 0001 Accepted with this scaffold).

Root install; TypeScript in cli/:

```bash
npm install
npm run arggon -- hello
npm run arggon -- init /path/to/repo
npm run arggon -- list
npm run arggon -- validate
npm run build
npm test
npm run lint
```

`arggon init` creates `tasks/.convention.yml` and copies `templates/` (no overwrite unless --force; already-initialized repos are a no-op).

### `arggon list`

Finds `tasks/` with walk-up from cwd (same as `create`), loads work items with the shared kernel, and prints a table (or `--json`). Listing order is lexicographic by `id`. Filters compose with AND.

```bash
arggon list
arggon list --status todo
arggon list --type bug --assignee @me
arggon list --json
arggon --json list --type task --status in_progress
arggon list --filter "status:todo !label:security"
arggon list --view my-open-bugs
arggon list --stale --older-than 7d
```

- --status <status>: exact v0 status (`todo`, `in_progress`, `blocked`, `done`, `cancelled`)
- --type <type>: exact v0 type (`initiative`, `epic`, `story`, `task`, `bug`)
- --assignee <login>: exact assignee. Special @me resolves via `GITHUB_USER`, then `GITHUB_ACTOR`, then `gh api user -q .login`
- --filter <expr>: compact filter ANDed with the flags (fields `status`, `type`, `assignee`, `label`, `parent`, `depends-on`, `blocked-by`; `!` negates; quotes allow spaces, e.g. `assignee:"Jane Doe"`); unknown fields are usage errors. `depends-on:<id>` matches items whose `depends_on` contains `<id>`; `blocked-by:<id>` matches the computed inverse — items that `<id>` depends on
- --view <name>: named saved view from the `x-views` map in `tasks/.convention.yml`, ANDed with the flags and `--filter` (e.g. `x-views:\n  my-open-bugs: "type:bug status:todo !assignee:someone"`); unknown names fail listing the known views
- --stale --older-than <duration>: stale-claim report (advisory only). Matches claimed items (in_progress + assignee) whose `claimed_at` lease is older than the threshold relative to now; `<duration>` is `<number><d|h|m>` (e.g. `7d`, `12h`, `30m`); invalid durations fail with `LIST_FAILED`. Items claimed before `claimed_at` existed (no `claimed_at`) count as stale. Composes with the other list filters; `--stale` requires `--older-than` and vice versa
- --json: one compact JSON object on stdout (envelope v1: `ok`, `schemaVersion: 1`, `conventionVersion`, `command: "list"`, `items: WorkItem[]`); failures emit `ok: false` with `code: "LIST_FAILED"`

Empty results exit `0` (`items: []` with `--json`). Missing `tasks/`, invalid enums, unresolvable @me, or unreadable work-item files exit non-zero.

`arggon create <type> <title>` writes a work item under `tasks/` from the templates. Non-initiative types need `--parent <id>`. Defaults: `status: todo`, `created`/`updated` today. Flags: `--id`, `--assignee`, `--status` (not `done`), `--blocked-reason`.

`arggon update <id>` edits frontmatter in place (only requested fields). Enforces v0 status transitions, the claim rule (`in_progress` on story/task/bug needs `--assignee`), and `blocked_reason` rules; always touches `updated`. Transitions `in_progress` → `todo` clear `assignee` **and `branch`** by default (override with explicit `--assignee` / `--branch`); leaving `blocked` clears `blocked_reason`. Reassigning a claimed item fails with a claim conflict unless `--force` (see [docs/claim.md](docs/claim.md)). Claiming sets the additive `claimed_at` lease (ISO date-time, also set by `arggon start`); unclaim/`todo` or closing the item clears it. `claimed_at` is reporting only — it never gates a transition. Flags: `--title`, `--status`, `--assignee`, `--branch <name>` (empty clears), `--unassign`, `--labels <csv>` (replace), `--depends-on <csv>` (replace the dependency-id list, v3; empty clears), `--add-depends-on <id>` (append one dependency), `--blocked-reason`, `--force`, `--steal --reason "<why>" --assignee <you>` (human-only supervised takeover of a claimed item: reassigns to you, refreshes `claimed_at`, and appends a dated `> stolen <date> by <you>: <reason>` note to the item body; agents are refused like `--force`; mutually exclusive with `--force`), `--json` (envelope v1 `{ item }`, failures `UPDATE_FAILED`). Dependencies are advisory: they never block updates — `validate` checks unknown ids, self-references, and cycles ([docs/convention.md](docs/convention.md), v3).

`arggon branch <id>` checks out the working branch for an item: uses the recorded `branch` field when set (attach), else generates it from `branch_patterns` in `tasks/.convention.yml` (`{id}`/`{type}` placeholders; defaults `feat/{id}`, `fix/{id}` for bugs) and persists it. Fails clearly when the branch exists without matching the field. Flags: `--json` (envelope `{ item, branch, created }`, failures `BRANCH_FAILED`).

`arggon start <id>` claims (`in_progress` + `--assignee`, never `--force`), checks out the branch, commits the claim, pushes, and with `--open-pr` opens a draft PR with the item id in the body. Refuses dirty trees and taken claims. With `--worktree` the whole flow runs inside a linked git worktree at `../<repo-name>-<id>` (created from, or attached to, the item's branch): the claim commit, push, and draft PR run there, the main checkout stays on its current branch, and the absolute worktree path is recorded on the item's additive `worktree_path` field. Re-running with `--worktree` attaches to the recorded worktree instead of failing. Flags: `--assignee` (default `GITHUB_USER`/`GITHUB_ACTOR`), `--open-pr`, `--worktree`, `--json` (envelope `{ item, branch, created, pushed, prUrl, worktreePath }`, failures `START_FAILED`).

`arggon cleanup` reaps worktrees of closed work (see `start --worktree` above). Every item with a recorded `worktree_path` is classified: removable when the item is `done`/`cancelled` and its recorded branch is fully merged into the default branch (`origin/HEAD`, else local `main`/`master`); anything else (open item, unmerged or missing branch) is reported as skipped and never touched. The default mode only lists; `--prune` removes removable worktrees (`git worktree remove` — dirty worktrees are refused by git), deletes their merged branches (`git branch -d`), and clears the `worktree_path` records, reporting each action. Flags: `--prune`, `--json` (envelope `{ base, candidates, pruned }`, failures `CLEANUP_FAILED`).

`arggon next` suggests the next claimable item: unclaimed `todo` of claimable type (story/task/bug), lexicographic by id, with parent chain and reason. Dependency-aware (v3): ready items — those whose `depends_on` are all `done`/`cancelled` — rank first, and when the suggestion still has open dependencies the `reason` lists them and the JSON suggestion carries the additive `blockedBy: string[]` (open dependency ids). Dependencies are advisory: they shape suggestions only, never updates. Empty pool exits `0` with a friendly message. Flags: `--ready` (limit the pool to ready items only), `--json` (envelope `{ suggestion: { item, parentChain, reason, blockedBy } | null }`, failures `NEXT_FAILED`).

Shared kernel: `cli/src/paths.ts`, `frontmatter.ts`, `ids.ts`, `status.ts`, `items.ts`, `relations.ts`, `dates.ts`.

### `arggon validate`

Checks `tasks/` frontmatter and tree integrity (schema, parents, naming, claim/blocked rules). Uses the shared items soft-scan (`walkTasksTree` / `softTryLoadItem`) so broken YAML still reports a file path. Exits non-zero when there are errors; warnings alone stay exit 0. Suitable for CI before commit.

```bash
arggon validate
arggon validate --json
npm run arggon -- validate
```

- `--json`: v1 envelope with `errors` / `warnings` (and `VALIDATE_FAILED` when failed)

Validate: `arggon validate` / `arggon validate --json` (CI gate; docs/json-output.md).

### `arggon board`

Writes a self-contained HTML board (columns = v0 statuses; cards show type, id, title, assignee, labels, parent, `blocked_reason`, `milestone`, plus a `↳ blocked by <id>` line per open dependency — v3; deps that are `done`/`cancelled` render nothing) from the same kernel read path as `list`. No writes to `tasks/` — the output is a generated snapshot; git files remain the source of truth. Stack decision: [docs/adr/0002-board-viewer-v0.md](docs/adr/0002-board-viewer-v0.md). Drag-and-drop is a client-side pre-check: the embedded script applies exactly the CLI drop rules, and every edit routes through the kernel update path — never raw file writes from the browser.

```bash
arggon board                  # writes board.html at the repo root (where tasks/ lives)
arggon board --out report/board.html   # explicit path, relative to cwd
arggon board --json           # v1 envelope: { path, itemCount }
arggon board --github         # overlay live GitHub PR state on cards with a branch (read-only)
arggon board --group-by milestone      # prototype (ADR 0003): group cards within each column
arggon board --serve          # local live-reload server on 127.0.0.1 (edits via the update path)
arggon board --serve --port 4173       # pick the port
arggon board --tui            # interactive read-only terminal kanban (raw ANSI, no deps)
```

- `--out <file>`: output path (default `board.html` at the repo root regardless of cwd); parent directories must exist
- `--json`: one JSON object on stdout; failures emit `code: "BOARD_FAILED"`
- `--github`: one `gh pr list` read matched by head ref name → per-card badge (`#N · draft/open/merged/closed` + checks `✓/✗/…`, neutral `○ no PR` without branch or PR); without gh auth fails clearly suggesting plain `board`; never writes to `tasks/`
- `--group-by milestone`: prototype per [ADR 0003](docs/adr/0003-milestone-field.md); items without a milestone group last
- `--serve`: serves the board locally, **bound to 127.0.0.1 only**, and reloads the page whenever any file under `tasks/` changes; drag-and-drop posts to the update endpoint, which runs the same kernel update rules as the CLI. `--serve --json` emits the standard envelope once (`{ serving, url, port }`)
- `--tui`: interactive, read-only terminal kanban over the same kernel read path — five v0 status columns, dependency-light (raw ANSI escapes, no TUI framework, zero new dependencies). Re-reads the tree after every keypress, so it always shows the current tree. Requires an interactive terminal (piped stdout fails with `BOARD_FAILED`); **not combinable with `--json`** (it is a view, not a data format) or `--serve`. Keybindings:

| Key | Action |
| --- | --- |
| `←` / `→` | move the selected column (v0 status order) |
| `↑` / `↓` | move the selected card within the column |
| `/` | open the search prompt (substring on id/title); `enter` applies, `esc` cancels |
| `esc` | clear the active filter |
| `enter` | print the selected item's file path (does not open an editor) |
| `q` / `Ctrl-C` | quit, restoring the screen |

The static export is a snapshot: re-run after tree changes to refresh (or use `--serve`). The generated file is a build artifact — safe to gitignore; deleting it loses nothing.

`arggon report` aggregates leaf (task/bug) statuses per story, grouped by epic, for display only (never writes). Every story gets a row — leafless stories show zeros with `(empty — no leaves)`, storiless epics `(empty — no stories)` — and `cancelled` has its own explicit column. Flags: `--format markdown` (standup summary: per-epic progress with `(done + cancelled)/total` plus a Blocked section with reasons) and `--json` (envelope `{ groups }` mirroring the table rows exactly, failures `REPORT_FAILED`).

`arggon report --trend` mines git history (story-report-trend): every status transition is a frontmatter diff in some commit under `tasks/`, so one `git log -p` pass yields time-series analytics with zero extra state. Pure read — `git log` only, never writes. Output: weekly completions bucketed by the ISO week of each leaf's first terminal transition (`done`/`cancelled`) and average cycle time per leaf type (first `in_progress` claim → terminal, in days, 1 decimal). Items still open count as not-completed; story/epic completions are not counted (leaves only). `--since <YYYY-MM-DD>` (UTC) limits the considered window: transitions before it are ignored, so items completed before the window drop out entirely. With `--trend`, the trend block is appended to the human table/markdown output and an additive `trend` payload is added to the `--json` envelope (`{ weeks: [{ week, completions }], cycleTime: [{ type, avgDays, count }] }`); failures (e.g. non-git tree) use `TREND_FAILED`. Default output without `--trend` is unchanged.

Closing work is easy on containers too: when an update reaches a terminal state and an ancestor's entire subtree is terminal, the ancestor auto-completes as `done` (cascade up to the initiative; opt out with `--no-cascade`).

### `arggon sync`

Reconciles `tasks/` with the repo's open GitHub PRs: `--check` (default, CI-safe) reports matched/unmatched items and exits non-zero when sync is pending; `--write` fills **only empty** `branch` fields — never overwrites a set branch, never guesses an ambiguous match, never touches status. Flags: `--repo <owner/repo>`, `--json`. Failures: `SYNC_FAILED`.

### `arggon spec`

Validates and scaffolds feature specs (`docs/specs/spec-<slug>-NNN.md`) and implementation plans (`docs/plans/plan-<slug>-NNN.md`) so agents can trust and check them. `spec validate` is a **pure read**: it checks frontmatter (`spec_id`/`plan_id` kebab-case, `title`, `status` (`proposed` | `implemented` | `superseded`), `created` as `YYYY-MM-DD`), required sections (Purpose or a non-empty intro, a Synopsis/Design/Model-of-data equivalent, Acceptance criteria — lenient about naming, including the Spanish sections of the existing specs, strict about acceptance), plans pointing at an existing spec file, and `spec_id` uniqueness across `docs/specs/`. Exits non-zero on errors.

```bash
arggon spec validate                  # check docs/specs/ + docs/plans/ (pure read, CI-safe)
arggon spec validate --file docs/specs/spec-deps-001.md   # single file, also outside docs/specs|plans
arggon spec validate --json           # v1 envelope { errors, warnings }; failures SPEC_FAILED
arggon spec new my-feature            # scaffold docs/specs/spec-my-feature-NNN.md
arggon spec new my-feature --title "My feature" --plan   # also scaffold docs/plans/plan-my-feature-NNN.md
arggon spec new my-feature --json     # v1 envelope { files: string[] }
```

`spec new` numbers globally (max existing NNN across `docs/specs` + `docs/plans`, plus 1) and **never overwrites** an existing file. Templates live in [`templates/spec.md`](templates/spec.md) / [`templates/plan.md`](templates/plan.md) (`{{SLUG}}`, `{{NNN}}`, `{{ID}}`, `{{TITLE}}`, `{{DATE}}` placeholders; an embedded copy in the CLI is the fallback). See the pipeline spec: [docs/specs/spec-spec-pipeline-002.md](docs/specs/spec-spec-pipeline-002.md).

### `arggon import-issues`

One-shot migration of an existing GitHub issue backlog into `tasks/` (the docs/agents.md §0 promise). Reads issues via `gh issue list --state all --limit 200 --json number,title,state,body,labels` and writes one task per issue through the same kernel as `create`/`update`. **Idempotent**: target ids are `task-issue-<number>`, so a re-run imports nothing (`created: 0`, everything skipped).

- status mapping: open → `todo`, closed → `done` (closed items are created `todo` and closed through the legal kernel path in the same run; the container auto-completion cascade may fire)
- title `issue #N: <issue title>`; body: the original issue body plus a `> imported from issue #N` provenance line
- labels: issue labels slugified to kebab-case and deduped; invalid ones are skipped silently but counted in the report
- target story: `story-imported-issues`, created under the first epic when missing (actionable error when the tree has no epic); override with `--parent <story-id>`

```bash
arggon import-issues                      # gh resolves the repo from cwd
arggon import-issues --repo owner/name    # explicit repository
arggon import-issues --dry-run            # print the would-create / would-skip plan, write nothing
arggon import-issues --parent story-backlog
arggon import-issues --json               # v1 envelope: { dryRun, story, entries, created, skipped, labels }
```

Failures exit non-zero (`IMPORT_FAILED` under `--json`): gh missing/unauthenticated (`gh auth login`), missing `tasks/`, a tree without an epic for the default story, or a malformed `--repo` / unresolvable `--parent`.

### `arggon comment`

Appends a timestamped, author-attributed comment section to an item's body — the handoff channel for agent context ("why blocked", "what the next agent should know"). Comments are history, not status changes: the write is **body-only** (frontmatter is re-serialized unchanged, `updated` is NOT bumped), it works on any item in any status including `done`/`cancelled` (this is NOT a reopen), and agents may comment on closed items. Section format:

```markdown
### 2026-09-11 @<author>
<text>
```

```bash
arggon comment story-login "Blocked on OAuth credentials; next agent: ping #ops"
arggon comment task-rate-limit "why blocked:
- waiting on repro from QA" --author octocat
arggon comment story-login "handoff note" --json
```

- `<text>`: comment text; multiline supported (each line lands under the heading; a blank line separates the section from the body). Multiple comments append in order
- `--author <login>`: attribution (rendered as `@<author>`); defaults to `@me` resolution — `GITHUB_USER`, then `GITHUB_ACTOR`, then `gh api user -q .login`. Unresolvable author fails with an actionable error
- `--json`: one compact JSON object on stdout (envelope v1: `ok`, `schemaVersion: 1`, `conventionVersion`, `command: "comment"`, `id`, `path`, `comment: { author, date, lines }`); failures emit `ok: false` with `code: "COMMENT_FAILED"` (unknown id, empty text, unresolvable author)

`arggon validate` keeps passing on a commented tree — comment sections are plain freeform Markdown in the body.

### `arggon instructions`

Prints the agent wiring (install commands, pre-commit hook, CI gate, `AGENTS.md` snippet) extracted at runtime from `docs/agents.md` — the CLI never duplicates the playbook text, so doc and command cannot drift. Flags: `--json` (`{ source, snippets: { install, precommit, ci, agent } }`, failures `INSTRUCTIONS_FAILED`).

### `arggon mcp`

Starts a stdio MCP server (JSON-RPC 2.0) exposing `arggon_list`, `arggon_create`, `arggon_update`, and `arggon_comment` with the same rules and JSON envelopes as the CLI. The MCP layer always runs with agent playbook rules: no reopening `done`/`cancelled`, no claim stealing. See [docs/agents.md](docs/agents.md) §MCP server.

Fixtures: [fixtures/](fixtures/).

## Contributing

Ideas on folder layout, frontmatter schema, and CLI UX are especially useful right now. Open an issue. Please follow the [task convention](docs/convention.md) when proposing sample trees or templates.

## License

MIT — see [LICENSE](LICENSE).

---

Built in the open by [Arggon](https://github.com/Arggon).
