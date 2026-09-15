# CLI JSON output contract (schemaVersion 1)

Stable machine-readable stdout for agents and scripts. Every `--json` response is **exactly one JSON object** on stdout (plus a trailing newline).

`--json` is a **global** flag on the root program, also accepted after the subcommand:

```bash
arggon --json <command>
arggon <command> --json
```

Example: `arggon --json hello`.

The MCP server (`arggon mcp`) returns these same envelope objects as tool-result text content for its `arggon_list`, `arggon_create`, `arggon_update`, `arggon_comment`, and `arggon_show` tools; kernel failures become tool errors carrying the same `ok: false` shape (see [`docs/agents.md`](./agents.md) §MCP server). The tool input schemas are parity-tested against the CLI option surface (`cli/src/mcp-parity.test.ts`): the two surfaces stay in sync by test, not by convention — schema changes are **additive only**; a breaking change bumps `schemaVersion`.

This flag is a formatter only. It does not walk `tasks/` or parse frontmatter. Commands that load domain objects pass those objects to the formatter. Human vs JSON printing lives in the CLI entrypoint.

---

## Envelope

Every success or failure payload includes:

| Field               | Type    | Notes                                                                                                                                 |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ok`                | boolean | `true` on success; `false` on failure                                                                                                 |
| `schemaVersion`     | number  | JSON **output** contract version. Currently **`1`**. Not the task-tree convention version.                                            |
| `conventionVersion` | number  | From `tasks/.convention.yml` (`version`). Omit file = **`0`**.                                                                        |
| `command`           | string  | Commander command name: `hello` \| `init` \| `doctor` \| `adopt` \| `list` \| `next` \| `report` \| `validate` \| `create` \| `update` \| `comment` \| `branch` \| `start` \| `cleanup` \| `board` \| `sync` \| `import-issues` \| `instructions` \| `spec` \| `explore` \| `playbook` \| `mcp` |

Command-specific fields sit next to this envelope (not nested under a generic `data` key).

### Compatibility

- **Additive** fields are OK within a `schemaVersion`.
- **Breaking** changes bump `schemaVersion`.
- Clients **MUST ignore** unknown fields.
- This CLI emits **`schemaVersion: 1` only**.
- Distinct from the convention **tree** version in [`docs/convention.md`](./convention.md). A v0 tree with JSON schema 1 is `{ schemaVersion: 1, conventionVersion: 0 }`; a v1 tree (with `branch`) reports `conventionVersion: 1`; a v2 tree (with `branch_patterns`) reports `conventionVersion: 2`; a v3 tree (with `milestone` + `depends_on` official) reports `conventionVersion: 3`.

### Failures (`ok: false`)

Include:

```ts
error: { message: string, code?: string }
```

Process exit code is **non-zero**. Do **not** mix human text onto stdout when `--json` is set; human diagnostics go to **stderr** only if needed (prefer a single JSON object on stdout).

### Empty success

Empty success stays `ok: true` (e.g. future `list` with no items → `items: []`).

---

## Shared types

### `WorkItem`

Stable fields aligned with convention v0 plus the additive `branch` (v1) and `milestone` / `depends_on` (v3) fields.

**Compact default (ADR 0006).** In `list` / `create` / `update` `--json` payloads, the optional fields below are **omitted when null/empty unless `--full`** is passed: `blocked_reason`, `milestone`, `worktree_path`, `issue` (when null), and `depends_on`, `labels` (when the array is empty). `schemaVersion` is unchanged — omission is a documented default, not a shape break: read optional fields as `item.field ?? null` and either shape works. `--full` restores the complete always-present shape shown in the table. Human output and the other commands are unaffected.

| Field            | Type                                                          | Notes                                                                       |

| Field            | Type                                                          | Notes                                                                       |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `id`             | `string`                                                      | Filename stem                                                               |
| `type`           | `initiative` \| `epic` \| `story` \| `task` \| `bug`          |                                                                             |
| `status`         | `todo` \| `in_progress` \| `blocked` \| `done` \| `cancelled` |                                                                             |
| `title`          | `string` \| `null`                                            | Canonical title when known                                                  |
| `assignee`       | `string` \| `null`                                            |                                                                             |
| `branch`         | `string` \| `null`                                            | Working branch (v1, additive); `null` when unset                            |
| `parent`         | `string` \| `null`                                            |                                                                             |
| `labels`         | `string[]`                                                    |                                                                             |
| `created`        | `string` \| `null`                                            | `YYYY-MM-DD`                                                                |
| `updated`        | `string` \| `null`                                            | `YYYY-MM-DD`                                                                |
| `path`           | `string`                                                      | Posix path relative to repo/tree root, e.g. `tasks/launch-mvp/auth/auth.md` |
| `blocked_reason` | `string` \| `null`                                            |                                                                             |
| `milestone`      | `string` \| `null`                                            | Prototype per ADR 0003 (official in v3); additive within `schemaVersion: 1` |
| `depends_on`     | `string[]`                                                    | Ids this item waits for (v3, ADR 0004); empty = none. Additive within `schemaVersion: 1`; `blocked_by` is the computed inverse and is never stored |
| `claimed_at`     | `string` \| `null`                                          | Soft lease: ISO date-time set when a claimable item is claimed (`in_progress` + assignee, via `update`/`start`) and cleared when the claim is released. Reporting only — never gates a transition. Additive within `schemaVersion: 1`; `null` for items claimed before the field existed |
| `worktree_path`  | `string` \| `null`                                          | Absolute path of the git worktree created by `start --worktree` (`../<repo-name>-<id>`). Additive within `schemaVersion: 1`; `null` when the item was started without worktree isolation |
| `issue`          | `number` \| `null`                                          | GitHub issue number recorded by `import-issues` (frontmatter `issue`). Additive within `schemaVersion: 1`; `null` when the item was not imported from an issue. `start --open-pr` appends `Closes #N` to the PR body for items carrying it |

Enums match [`docs/convention.md`](./convention.md) v0.

### `Issue`

```ts
{ path: string, message: string, code: string }
```

`path` is posix, relative to the repo/tree root.

---

## Command payloads

Every command that loads domain objects emits this envelope; `--json` is a formatter, human output lives in the CLI entrypoint.

### `instructions`

| Field              | Type                            | Notes                                                         |
| ------------------ | ------------------------------- | ------------------------------------------------------------- |
| `source`           | `string`                        | Playbook doc the snippets were extracted from (`docs/agents.md`) |
| `snippets.install` | `{ language, body }`            | Prerequisite shell commands, one per line                     |
| `snippets.precommit` | `{ language, body }`          | `.git/hooks/pre-commit` gate                                  |
| `snippets.ci`      | `{ language, body }`            | CI validate job                                               |
| `snippets.agent`   | `{ language, body }`            | AGENTS.md wiring snippet                                      |

Snippets are extracted from the playbook at runtime; failures use `error.code: "INSTRUCTIONS_FAILED"`.

### `hello`

| Field     | Type     |
| --------- | -------- |
| `message` | `string` |

### `init`

| Field                | Type       | Notes                                                                           |
| -------------------- | ---------- | ------------------------------------------------------------------------------- |
| `root`               | `string`   | Absolute path initialized                                                       |
| `alreadyInitialized` | `boolean`  | Whether `tasks/.convention.yml` existed before this run                         |
| `force`              | `boolean`  | Whether `--force` was set                                                       |
| `created`            | `string[]` | Paths created this run (posix, relative to `root`)                              |
| `updated`            | `string[]` | Untouched docs regenerated from the current template with refreshed `x-generated` state (posix, relative to `root`). Additive in v1: older clients ignore it |
| `modified`           | `string[]` | Adopter-modified docs (checksum differs, or no state entry): skipped by default, regenerated after `--backup`. Additive in v1: older clients ignore it |
| `backedUp`           | `string[]` | Subset of `modified[]` archived to `backup/<YYYY-MM-DD>/<dest>` before regeneration (`--backup` only). Additive in v1: older clients ignore it |
| `skipped`            | `string[]` | Doc files left untouched this run (posix, relative to `root`). Additive in v1: older clients ignore it |
| `restored`           | `string[]` | Missing templates restored when already initialized (posix, relative to `root`) |
| `commit`             | `object`   | Tracker auto-commit outcome for the files this run wrote (bug-init-leaves-docs-untracked-start-blocks-on-clean-tree): ONE `{ hash, message }` commit (`chore(tasks): generated init docs (N files)`) covering the generated/updated docs, templates, the tasks/ tree and `tasks/.convention.yml` — or `{ skipped: <reason> }` (`--no-commit`, non-git tree, git absent, nothing to commit). Additive within `schemaVersion: 1`. |

Failures use `error.code: "INIT_FAILED"`.

### `doctor`

Pure-read installation report (exit 0 on every well-formed input, including non-initialized repos):

| Field               | Type      | Notes                                                                        |
| ------------------- | --------- | ---------------------------------------------------------------------------- |
| `root`              | `string\|null` | Repo root; `null` when no `tasks/.convention.yml` was found             |
| `initialized`       | `boolean` | Whether `tasks/.convention.yml` exists (walk-up from cwd, like `create`)      |
| `docs`              | `object`  | Generated-doc provenance counts from `x-generated` (see below)                |
| `docs.managed`      | `number`  | Total `x-generated` entries                                                   |
| `docs.untouched`    | `number`  | Files whose sha256 still matches the recorded checksum                        |
| `docs.modified`     | `number`  | Files on disk whose checksum differs (or whose checksum is unparseable)       |
| `docs.acknowledged` | `number`  | Entries flagged `acknowledged: true` by `arggon adopt --ack` — sanctioned-diverged baselines; never regenerated by init (additive) |
| `docs.acknowledgedDrifted` | `number` | Acknowledged entries whose current checksum differs from the acked baseline — a hand edit after the ack; informational only, still adopter-owned (never `modified`, never regenerated) (additive) |
| `docs.stale`        | `number`  | Entries whose `template` no longer exists in the current template bundle      |
| `docs.missing`      | `number`  | Entries whose destination file is absent                                      |
| `tracker`           | `object`  | `{ items, todo }` — total work items under `tasks/` and their `todo` count    |

Each `docs` entry falls in exactly one bucket (`missing`, else `stale`, else `acknowledged`/`acknowledgedDrifted`, else `untouched`/`modified`), so `untouched + modified + acknowledged + acknowledgedDrifted + stale + missing = managed`. Failures use `error.code: "DOCTOR_FAILED"` (unexpected errors only — a missing tree is a normal report).

### `list`

| Field   | Type         | Notes                                 |
| ------- | ------------ | ------------------------------------- |
| `items` | `WorkItem[]` | Lexicographic by `id`, per convention |

Filters compose with the same engine as the flags. The v3 dependency predicates are `depends-on:<id>` (items whose `depends_on` contains `<id>`) and `blocked-by:<id>` (computed inverse — items that `<id>` waits for); `ancestor:<id>` matches items with `<id>` anywhere in their parent chain (the item itself does not count; unknown ids match nothing). All AND and negate (`!`) like the rest. `arggon list --parent <id>` is first-class sugar over the `parent:` predicate — exact direct-children match, ANDed with the flags and `--filter`; unlike the raw predicate, an unknown parent id fails with `LIST_FAILED` (`unknown parent "<id>"`) instead of matching nothing.

Stale-claim report: `arggon list --stale --older-than <duration>` (`<number><d|h|m>`, e.g. `7d`, `12h`, `30m`) limits the result to claimed items (in_progress + assignee) whose `claimed_at` is older than the threshold relative to now. It composes with the other filters; `--stale` requires `--older-than` (and vice versa) and invalid durations fail with `LIST_FAILED`. Claims from before `claimed_at` existed count as stale (advisory reporting only — staleness never blocks an update).

### `validate`

| Field      | Type      | Notes |
| ---------- | --------- | ----- |
| `errors`   | `Issue[]` |       |
| `warnings` | `Issue[]` |       |

`ok` is `false` **iff** `errors.length > 0` (warnings alone keep `ok: true`). When `ok` is false, the envelope still includes `error` so generic clients can branch on one field.

### `spec`

Covers both subcommands; the envelope `command` is always `"spec"`.

`spec validate [--file <path>]` (pure read over `docs/specs/*.md` / `docs/plans/*.md`, or one file with `--file`):

| Field      | Type      | Notes |
| ---------- | --------- | ----- |
| `errors`   | `Issue[]` | Same shape as `validate`; codes include `SPEC_MISSING_FRONTMATTER`, `SPEC_MISSING_FIELD`, `SPEC_BAD_STATUS`, `SPEC_BAD_DATE`, `SPEC_BAD_ID`, `SPEC_MISSING_SECTION`, `SPEC_DUPLICATE_ID`, `SPEC_READ_FAILED`, `PLAN_MISSING_FRONTMATTER`, `PLAN_MISSING_FIELD`, `PLAN_BAD_STATUS`, `PLAN_BAD_DATE`, `PLAN_SPEC_NOT_FOUND`, `PLAN_DUPLICATE_ID` |
| `warnings` | `Issue[]` | Currently always empty |

`ok` is `false` **iff** `errors.length > 0`; failed runs carry `error.code: "SPEC_FAILED"`.

`spec new <slug> [--title <t>] [--plan]` scaffolds `docs/specs/spec-<slug>-NNN.md` (plus `docs/plans/plan-<slug>-NNN.md` with `--plan`) from the bundled templates; never overwrites.

| Field   | Type       | Notes                                        |
| ------- | ---------- | -------------------------------------------- |
| `files` | `string[]` | Created paths, posix, relative to the repo root |

Failures use `error.code: "SPEC_FAILED"` (invalid slug, refusing to overwrite, missing `tasks/`).

### `explore`

`stack explore <topic> [--title <t>]` scaffolds `docs/explorations/exploration-<slug>-NNN.md` (candidates, criteria, findings with dated sources, recommendation, Decision/ADR placeholder); never overwrites. The envelope `command` is `"explore"`.

| Field   | Type       | Notes                                        |
| ------- | ---------- | -------------------------------------------- |
| `files` | `string[]` | Created paths, posix, relative to the repo root |

Failures use `error.code: "EXPLORE_FAILED"` (unslugifiable topic, refusing to overwrite, missing `tasks/`).

### `playbook`

Covers all `playbook` subcommands; the envelope `command` is always `"playbook"`.

`playbook new <tech> [--version <v>] [--title <t>]` scaffolds `docs/playbooks/<tech>.md` (frontmatter `playbook_id` / `version` / `researched` / `status: current`; one playbook per tech); never overwrites.

| Field   | Type       | Notes                                        |
| ------- | ---------- | -------------------------------------------- |
| `files` | `string[]` | Created paths, posix, relative to the repo root |

`playbook status [--max-age-days <n>] [--file-task <story-id>]` (pure read unless `--file-task` files tasks):

| Field         | Type       | Notes                                                                                            |
| ------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `playbooks`   | `object[]` | One entry per playbook in `docs/playbooks/`, sorted by id                                        |
| `playbooks[].id`         | `string`        | Frontmatter `playbook_id`, else the filename stem                          |
| `playbooks[].version`    | `string`        | Frontmatter `version`; `"unknown"` when missing                            |
| `playbooks[].researched` | `string\|null`  | `YYYY-MM-DD` as recorded; `null` when missing/unparseable                  |
| `playbooks[].ageDays`    | `number\|null`  | Whole days from `researched` to today (UTC); `null` when unknown           |
| `playbooks[].stale`      | `boolean`       | `ageDays > maxAgeDays`; unknown age counts as stale                        |
| `playbooks[].path`       | `string`        | Posix path relative to the repo root                                       |
| `staleCount`  | `number`   | Entries with `stale: true`                                                                       |
| `maxAgeDays`  | `number`   | Effective threshold: `--max-age-days`, else `x-playbooks.max-age-days`, else 90                  |
| `created`     | `string[]` | With `--file-task`: ids of re-research tasks created this run (`task-re-research-<tech>`, status `todo`) |
| `skipped`     | `string[]` | With `--file-task`: ids whose re-research task already existed (idempotent skip)                 |

`playbook refresh <tech> --version <v>` (frontmatter-only write, body untouched):

| Field        | Type     | Notes                                       |
| ------------ | -------- | ------------------------------------------- |
| `path`       | `string` | Updated playbook path, posix, relative to the repo root |
| `version`    | `string` | The re-researched version                   |
| `researched` | `string` | Today, `YYYY-MM-DD`                         |

Failures use `error.code: "PLAYBOOK_FAILED"` (bad slug, refusing to overwrite, missing `tasks/`, unknown playbook, missing story for `--file-task`, invalid `--max-age-days`).

### `create` / `update`

| Field          | Type       | Notes                                                                                             |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `item`         | `WorkItem` | Item as persisted                                                                                 |
| `autoCompleted` | `string[]` | `update` only: ancestors auto-completed to `done` by the container-completion cascade (see convention.md); empty when `--no-cascade` or a non-terminal status. Additive within `schemaVersion: 1`. |
| `cascadeLevels` | `string[]` | `update` only: container TYPES auto-completed, parallel to `autoCompleted`. Additive. |
| `cascadeSkipped` | `Array<{ id, type, reason: "acceptance-incomplete" \| "subtree-open", sibling? }>` | `update` only: ancestor containers the cascade did NOT complete, with the reason — always present as an array, `[]` when nothing was skipped (bug-cascadeskipped-array-alignment; same always-arrays convention as `autoCompleted`/`cascadeLevels`). `acceptance-incomplete` (task-cascade-acceptance-aware): the container's own body still has unchecked acceptance checkboxes. `subtree-open` (task-cascade-subtree-open-visibility): the walk stopped because a sibling subtree still holds a non-terminal item — `sibling` carries that blocking sibling's id (direct child of the skipped container). Additive. |
| `movedFrom` | `string` | `update` only, present when `--parent` moved the item (task-update-reparent): absolute path of what moved — the item file for a leaf (task/bug), the item directory for a container (story/epic). Additive within `schemaVersion: 1`. |
| `commit`       | `object`   | Tracker auto-commit outcome (task-auto-commit-tracker). `create`: `{ hash, message }` when the created file was committed, `{ skipped: <reason> }` otherwise (`--no-commit`, non-git tree, nothing to commit). `update`: present when the run actually changed something — ONE commit covering the updated item plus any cascade-completed ancestors, `{ hash, message }` or `{ skipped: <reason> }` (`--no-commit`, non-git tree). Additive within `schemaVersion: 1`. |

MCP parity (`task-list-parent-flag`): the `arggon_update` tool exposes `parent` (`{"parent": "<id>"}`) with exactly the kernel-level edge validation the CLI runs — unknown parent, wrong parent type, and reparent-under-own-descendant all fail as `UPDATE_FAILED` tool errors with the CLI message text.

`update --steal` refusals (bug-cli-steal-not-gated) surface as normal `ok: false` envelopes with `code: "UPDATE_FAILED"` and one of two `message`s: `steal is disabled in this repo (x-tracker.allow-steal: true in tasks/.convention.yml arms it)` (repo not armed — the default) or `--steal requires an interactive terminal (agents must not steal claims — docs/agents.md)` (non-TTY stdin: agents, scripts, CI — even when armed and even with `y` piped in). A declined TTY confirmation fails with `--steal aborted (confirmation declined)`. Reopening is gated the same way (bug-reopen-ungated-cli, no config opt-in): `--status todo` on a `done`/`cancelled` item refuses non-TTY stdin with `--status todo on a done/cancelled item requires an interactive terminal (agents must not reopen — docs/agents.md)`, and a declined TTY confirmation fails with `reopen aborted (confirmation declined)`. Both surface as `ok: false` envelopes with `code: "UPDATE_FAILED"`.

Tracker auto-commit (story-tracker-hygiene): `init` (bug-init-leaves-docs-untracked-start-blocks-on-clean-tree), `create`, `update`, `comment`, `adopt`, `cleanup --prune`, and `import-issues` commit ONLY their own mutated paths (`chore(tasks): <verb> <id>`; init uses `chore(tasks): generated init docs (N files)` for its bootstrap commit — generated docs, templates, the tasks/ tree and `.convention.yml` together — so a fresh init never leaves untracked tool-generated state that would block `start`'s clean-tree precondition); the user's pre-existing dirty files are never staged. `--no-commit` opts out per invocation; `tasks/.convention.yml` `x-tracker.auto-commit: false` opts out tree-wide (flag wins over config, config wins over the default `true`). Skips are reported, never failures — the CLI works without git. Under git `index.lock` contention (bug-autocommit-silent-skip) the commit is retried with a short bounded backoff; if a skip is still unavoidable it is reported as `{ skipped: "git index locked" }` AND as a stderr warning (`commit skipped: git index locked`) — never silent.

### `comment`

Appends a timestamped, author-attributed comment section (`### <date> @<author>` + text lines) to the item **body**. Body-only write: the frontmatter is re-serialized unchanged — `updated` is NOT touched (a comment is history, not a status change), and commenting on `done`/`cancelled` items is allowed (this is not a reopen).

| Field             | Type       | Notes                                          |
| ----------------- | ---------- | ---------------------------------------------- |
| `id`              | `string`   | Commented item id                              |
| `path`            | `string`   | Absolute path of the item file                 |
| `comment.author`  | `string`   | Resolved author login (rendered `@<author>`)   |
| `comment.date`    | `string`   | `YYYY-MM-DD` (UTC) rendered in the heading     |
| `comment.lines`   | `string[]` | Comment text lines appended under the heading  |
| `commit`          | `object`   | Tracker auto-commit outcome: `{ hash, message }` when the commented file was committed, `{ skipped: <reason> }` otherwise. Additive within `schemaVersion: 1`. |

Failures use `error.code: "COMMENT_FAILED"` (unknown id, empty text, unresolvable author — pass `--author <login>` or set `GITHUB_USER`/`GITHUB_ACTOR`).

### `branch`

| Field     | Type       | Notes                                                |
| --------- | ---------- | ---------------------------------------------------- |
| `item`    | `WorkItem` | Item with the persisted `branch` field               |
| `branch`  | `string`   | Resolved working branch name                         |
| `created` | `boolean`  | `true` when `git checkout -b` ran; `false` on attach |

Failures use `error.code: "BRANCH_FAILED"` (unknown id, bad `branch_patterns`, non-git tree, or branch exists without matching the recorded field).

### `start`

| Field     | Type           | Notes                                                |
| --------- | -------------- | ---------------------------------------------------- |
| `item`    | `WorkItem`     | Item as claimed (with the persisted `branch` field)  |
| `branch`  | `string`       | Working branch name                                  |
| `created` | `boolean`      | `true` when `git checkout -b` ran; `false` on attach |
| `pushed`  | `boolean`      | `true` when the branch was pushed this run           |
| `prUrl`   | `string\|null` | Draft PR URL with `--open-pr`; `null` otherwise      |
| `worktreePath` | `string\|null` | Absolute worktree path with `--worktree`; `null` otherwise. Additive within `schemaVersion: 1` |
| `postStart` | `object` | Outcome of the `x-worktree.post-start` hook (task-start-post-hook): `{ command, ok: true }` or `{ command, ok: false, error }` (`error` = `post-start failed: <command> → <stderr tail> (hint: hooks inherit the environment of the process that ran arggon — use absolute paths, or set x-worktree.post-start-shell: "login")`; hook failure never fails the start). The shell used follows `x-worktree.post-start-shell` (default `inherit`) or the `--post-start-shell` flag. Present only when a new worktree was created and a hook ran (no config, `--no-hook`, or attach: field absent). Additive within `schemaVersion: 1` |

With `--worktree` the claim commit, push, and draft PR run inside the worktree and the item's `worktree_path` is persisted (re-runs attach to the recorded path). When the item carries an imported GitHub issue number (`WorkItem.issue`), the PR body ends with `Closes #N` so GitHub closes the issue when the PR merges; items without it are unchanged. Failures use `error.code: "START_FAILED"` (unknown id, taken claim — never forced, dirty tree, existing branch, non-git tree, worktree path occupied by a non-worktree, or gh failure).

### `cleanup`

| Field        | Type         | Notes                                                                                     |
| ------------ | ------------ | ----------------------------------------------------------------------------------------- |
| `base`       | `string`     | Ref the merge check runs against (`origin/HEAD`, else local `main`/`master`)              |
| `candidates` | `object[]`   | One entry per item with a `worktree_path` record, lexicographic by id                      |
| `candidates[].id`        | `string`         | Item id                                                       |
| `candidates[].status`    | `string`         | Item status at classification time                            |
| `candidates[].branch`    | `string\|null`   | Recorded branch                                               |
| `candidates[].path`      | `string`         | Recorded absolute worktree path                               |
| `candidates[].removable` | `boolean`        | True when `--prune` would remove it (terminal item + merged branch) |
| `candidates[].reason`    | `string\|null`   | Why it is skipped (null when removable)                       |
| `candidates[].action`    | `string\|null`   | What `--prune` does for it (null when skipped)                |
| `candidates[].via`       | `string`         | Additive within `schemaVersion: 1` (task-cleanup-squash-merge). Present when the branch failed git ancestry but a squash-merged PR proved integration: `squash-merged PR #N` |
| `pruned`     | `object[]`   | `{ id, action }` entries performed (empty without `--prune`); a failed step reports `action: "failed"` with additive `error` and, when the branch delete failed after the worktree was removed, `leftoverBranch: <name>` — per-candidate, the run continues. Steps enabled by the squash-merge fallback (not git ancestry) carry additive `via: "squash-merged PR #N"` |
| `failures`   | `string[]`   | Per-item prune failures that kept the run going (`<id>: <message>`); empty when every candidate completed. Additive within `schemaVersion: 1` |
| `commit`     | `object`     | With `--prune`: tracker auto-commit outcome for the cleared `worktree_path` records — `{ hash, message }` or `{ skipped: <reason> }`. Additive within `schemaVersion: 1`; absent when nothing was pruned |

Default mode only lists. `--prune` removes removable worktrees (`git worktree remove` — git refuses dirty worktrees), deletes their merged branches (`git branch -d`), and clears the `worktree_path` records; skipped entries (non-terminal item, unmerged/missing branch) are never touched. Remote safety (bug-cleanup-partial-failure): when `origin/<branch>` exists, its tip must also be merged into `base` before anything is removed; otherwise the candidate is skipped with `reason: "remote branch divergent or behind (origin/<branch>) — push or delete the remote branch first"` (a lost final push must never strand the remote tip). Prune is transactional per candidate: all checks run before `git worktree remove`; if `git branch -d` still fails afterwards (race), the `worktree_path` record is cleared (the worktree is gone) and the leftover branch is reported via `leftoverBranch`. Per-item prune failures never abort the run and do NOT raise `CLEANUP_FAILED` — they appear in `pruned` (`action: "failed"`, `error`) and `failures`. Failures use `error.code: "CLEANUP_FAILED"` only for top-level errors (non-git tree, undetectable default branch). Squash merges (task-cleanup-squash-merge): when the ancestry check fails, cleanup queries gh (`gh pr list --state merged --head <branch> --json number,url,mergedAt --limit 5`); a merged PR makes the candidate prunable (branch deleted with `git branch -D`, actions annotated `via`), no match skips with `reason: "branch not merged and no merged PR found"`, and an unavailable gh skips with `reason: "ancestry check failed and gh is unavailable to check for squash-merged PRs"` — the gh lookup never breaks the run. `--no-gh` skips the fallback entirely (ancestry-only, for offline/CI use).

### `next`

| Field                    | Type             | Notes                                                          |
| ------------------------ | ---------------- | -------------------------------------------------------------- |
| `suggestion`             | `object \| null` | One suggestion object, or `null` when the todo pool is empty   |
| `suggestion.item`        | `WorkItem`       | Suggested unclaimed todo (claimable type, lexicographic by id) |
| `suggestion.parentChain` | `string[]`       | Parent ids root-first                                          |
| `suggestion.reason`      | `string`         | Why this item was chosen                                       |
| `suggestion.blockedBy`   | `string[]`       | Additive (v3): open (non-terminal) dependency ids of the suggestion; empty when ready |

Dependency-aware ranking (v3, [ADR 0004](adr/0004-milestone-deps-v3.md)): ready items — `depends_on` all `done`/`cancelled` — rank first (lexicographic within each group); `--ready` limits the pool to ready items only, in which case `blockedBy` is always empty. When the suggestion has open dependencies, `reason` names them. Dependencies are advisory: they gate suggestions and queries only, never `update`.

Empty pool is success (`ok: true`, `suggestion: null`). Failures use `error.code: "NEXT_FAILED"` (missing tasks/, unreadable items).

### `show`

Reads one item with bounded output ([ADR 0006](adr/0006-token-context-efficiency.md), spec `show-item-003`): progressive disclosure so agents never pay for an unbounded comment tail on every read. Pure read — never writes, exit 0 on success.

| Field             | Type        | Notes                                                                                                |
| ----------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `item`            | `WorkItem`  | The item's frontmatter fields (contract shape)                                                       |
| `path`            | `string`    | Absolute path of the item file                                                                       |
| `comments`        | `object[]`  | The comments INCLUDED by this view, in document order: `{ date, author, lines }` (heading excluded)  |
| `body`            | `string`    | Only under `--body`: the item's verbatim markdown body; `comments` then carries ALL comments          |

View selection: default is compact — frontmatter + the body's last 3 comments; `--tail-comments <n>` overrides the tail size; `--meta` drops `comments` entirely (frontmatter only); `--body` is the explicit unbounded opt-in (verbatim `body` + all `comments`). The MCP `arggon_show` tool (`id`, `meta`, `body`, `tail_comments`) returns the identical payload.

Failures use `error.code: "SHOW_FAILED"` (unknown id, missing tasks/, unreadable items).

### `report`

| Field                 | Type                  | Notes                                                            |
| --------------------- | --------------------- | ---------------------------------------------------------------- |
| `groups`              | `object[]`            | One entry per epic, lexicographic by id (same rows as the table) |
| `groups[].epic`       | `{id, title}`         | The epic                                                         |
| `groups[].initiative` | `{id, title} \| null` | Parent initiative (null when absent)                             |
| `groups[].containers` | `object[]`            | One entry per story: `{id, title, type, counts, empty}`          |
| `groups[].totals`     | `counts`              | Sums over the epic's stories                                     |
| `groups[].empty`      | `boolean`             | True when the epic has no stories                                |
| `trend`               | `object`              | Additive, present only with `--trend` (git-history mining)       |
| `trend.weeks`         | `object[]`            | `{ week, completions }`, ascending ISO week ("2026-W37"), only weeks with >= 1 completion |
| `trend.cycleTime`     | `object[]`            | `{ type, avgDays, count }` per leaf type (task/bug/story), alphabetical; `avgDays` rounded to 1 decimal |

`counts` always carries all five statuses (`todo`, `in_progress`, `blocked`, `done`, `cancelled` — cancelled explicit, never lumped) plus `total`. Leafless stories report zeros with `empty: true`. Display-only: never writes. Failures use `error.code: "REPORT_FAILED"` (missing tasks/, unreadable items).

`--trend` mines git history (story-report-trend): a single `git log -p` pass over `tasks/` collects `+status:` frontmatter transitions per item file. Completions are first terminal transitions (`done`/`cancelled`) of ALL item types (initiative/epic/story/task/bug) bucketed by the ISO week of the commit's committer date, so story-driven projects get non-empty trends; cycle time is first `in_progress` claim → terminal in days, per leaf type (`task`/`bug`/`story` — containers stay excluded). Open items count as not-completed. `--since <YYYY-MM-DD>` (UTC) filters the considered window — transitions before it are ignored, so items completed before the window drop out entirely; an item whose claim predates the window completes without a measurable cycle time. `--since` requires `--trend`. Trend failures (non-git tree, `git log` errors) use `error.code: "TREND_FAILED"`; a tasks/ tree with no commits yet is not a failure and yields empty series.

Human output supports `--format table` (default) and `--format markdown` (standup summary: per-epic progress lines with `(done + cancelled)/total` completion, plus a Blocked section listing each leaf's `blocked_reason`). With `--trend` the trend block is appended to both (markdown gains a `## Trend` section). Markdown is stdout-only (not part of the JSON contract); both formats are pure tree reads — no network, no GitHub calls.

### `board`

| Field       | Type      | Notes                                                                |
| ----------- | --------- | -------------------------------------------------------------------- |
| `path`      | `string`  | Output HTML path (display form); absent with `--serve`                |
| `itemCount` | `number`  | Items rendered                                                       |
| `groupBy`   | `string`  | Present with `--group-by` (prototype: `milestone`)                    |
| `serving`   | `boolean` | Present and `true` only with `--serve`                                |
| `url`       | `string`  | `--serve` only: loopback base URL (`http://127.0.0.1:<port>`)         |
| `port`      | `number`  | `--serve` only: bound port                                            |
| `github`    | `boolean` | Present and `true` only with `--github` (not combinable with `--serve`) |
| `prCount`   | `number`  | PRs matched to card branches; present only with `--github`            |

With `--github` the board overlays live PR state (number, draft/ready, checks) on cards with a `branch`, matched by head ref name; cards without a branch or PR get a neutral badge. Without the flag the board is a fully offline snapshot. Failures use `error.code: "BOARD_FAILED"` (missing tasks/, or without gh auth — run plain `board` for the offline snapshot).

`--serve` is combinable with `--json` (unlike `--github`/`--tui`, which fail with `BOARD_FAILED` under `--serve`): it is a one-shot programmatic server-start signal — the standard `board` envelope is emitted exactly once, with `serving: true`, the loopback `url` and the bound `port`, and then the process keeps serving; nothing further is written to stdout by the CLI itself.

`--tui` is an interactive read-only terminal kanban (story-tui-board), **not a data format**: it is not combinable with `--json` (fails with `error.code: "BOARD_FAILED"`) and emits no envelope — it renders ANSI frames until you press `q`. It also fails with `BOARD_FAILED` when stdout is not a TTY (piped output). It performs no writes: it re-reads the tree over the same kernel read path as `list`/`board` after every keypress.

### `sync`

| Field         | Type                             | Notes                                                                 |
| ------------- | -------------------------------- | --------------------------------------------------------------------- |
| `mode`        | `"check" \| "write"`             | `--write` requested; check is the default                             |
| `matched`     | `string[]`                       | Items whose branch matches an open PR (write: incl. filled)           |
| `unmatched`   | `string[]`                       | Items with a recorded branch but no open PR on it                     |
| `pending`     | `string[]`                       | Check mode: fill available (see `suggestions`) or candidates disagree |
| `ambiguous`   | `{ id, branch, prs }[]`          | Multiple open PRs share one head branch — reported, never guessed     |
| `suggestions` | `{ id, branch, pr }[]`           | Empty-branch leaves a `--write` run can (check) or did (write) fill   |
| `filled`      | `Record<string, string> \| null` | Write mode: id -> branch actually written                             |
| `exit_code`   | `0 \| 1`                         | Mirrors the process exit code                                         |

Matching: items with a `branch` reconcile by exact head-ref equality (any type); empty `branch` fields are fill candidates only for leaves (`task`/`bug`) whose id starts a branch path segment and is not immediately followed by a letter or digit. Trailing hyphen suffixes deliberately still match — `feat/task-1-work` references `task-1` (this is what makes `chore/{id}-{type}` patterns fillable) — while `feat/task-12` does not reference `task-1`, and a longer id is never matched by its hyphen prefix (`feat/task-1` does not reference `task-1-work`). `--write` fills only empty fields — it never overwrites a set branch, never touches `status`, and never resolves ambiguity.

**Exit-code semantics (differs from `ok`):** the process exits non-zero when check mode finds sync needed (`pending`/`ambiguous`) or the run errored, so `arggon sync --check` works as a CI gate after `arggon sync --write`. `ok` stays `true` for those — it is `false` only when the sync itself failed. Failures use `error.code: "SYNC_FAILED"` (missing tasks/, conflicting flags, or gh unavailable).

### `import-issues`

One-shot GitHub issue import (idempotent): every issue becomes a leaf item under a parent story — open → `todo`, closed → `done`; `--dry-run` computes the plan and writes nothing (including the default story). The imported type follows the label mapping (`x-import.label-types`; default: `bug`-labeled issues import as bugs, everything else as tasks), so target ids are `task-issue-<number>` or `bug-issue-<number>` — re-running imports nothing (`created: 0`, every entry `skipped`).

| Field                   | Type                                                              | Notes                                                                                          |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `dryRun`                | `boolean`                                                         | `true` with `--dry-run` (plan only, no writes)                                                 |
| `story`                 | `{ id: string, created: boolean }`                                | Target story; `created` is true when this run created `story-imported-issues` (always `false` in dry-run) |
| `entries`               | `object[]`                                                        | One entry per issue, in gh order                                                               |
| `entries[].issue`       | `number`                                                          | GitHub issue number                                                                            |
| `entries[].id`          | `string`                                                          | Target/imported item id (`<type>-issue-<number>`, type per the label mapping)                  |
| `entries[].title`       | `string`                                                          | `issue #<n>: <issue title>`                                                                    |
| `entries[].status`      | `"todo" \| "done"`                                                | Mapped from the issue state                                                                    |
| `entries[].action`      | `"created" \| "skipped" \| "would-create" \| "would-skip"`        | `would-*` only with `--dry-run`                                                                |
| `created`               | `number`                                                          | Items written this run                                                                         |
| `skipped`               | `number`                                                          | Issues whose id already existed (idempotent re-run: all of them)                               |
| `labels`                | `{ mapped: number, skipped: number }`                             | Issue labels mapped into item labels (kebab-case, deduped); `skipped` counts invalid ones dropped silently |
| `commit`                | `object`                                                          | Tracker auto-commit outcome (task-autocommit-update-import): ONE `{ hash, message }` commit (`chore(tasks): imported N issues`) covering the story and every created/updated item, or `{ skipped: <reason> }`. Additive within `schemaVersion: 1`; absent in dry-run / when nothing was written |

Each created item records the GitHub issue number in its frontmatter (`issue: <number>`, exposed as `WorkItem.issue`), so `arggon start <id> --open-pr` can close the issue on merge with `Closes #N`.

Failures use `error.code: "IMPORT_FAILED"` (gh missing/unauthenticated or unparseable output, missing `tasks/`, no epic for the default story, malformed `--repo`, `--parent` that does not resolve to a story, a malformed `x-import` section, or an `x-import.label-types` mapping to a non-leaf type — imported issues are leaves under the target story).

---

## Example payloads

### `hello`

```json
{
  "ok": true,
  "schemaVersion": 1,
  "conventionVersion": 0,
  "command": "hello",
  "message": "arggon: hello from Phase 1 scaffold"
}
```

### `init` success (fresh scaffold)

```json
{
  "ok": true,
  "schemaVersion": 1,
  "conventionVersion": 0,
  "command": "init",
  "root": "/tmp/example-repo",
  "alreadyInitialized": false,
  "force": false,
  "created": [
    ".editorconfig",
    ".github/CODEOWNERS",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/copilot-instructions.md",
    "AGENTS.md",
    "CLAUDE.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "docs/tracking.md",
    "tasks/.convention.yml",
    "templates/bug.md",
    "templates/epic.md",
    "templates/initiative.md",
    "templates/story.md",
    "templates/task.md"
  ],
  "updated": [],
  "modified": [],
  "backedUp": [],
  "skipped": [],
  "restored": []
}
```

Init still **writes** `tasks/.convention.yml` (including the `x-generated` provenance section), `templates/`, and the governing docs (tier-1 by default; tier-2 with `--full`), then auto-commits exactly the files it wrote (tracker hygiene, bug-init-leaves-docs-untracked-start-blocks-on-clean-tree: a fresh init must leave a clean tree so `start`'s clean-tree precondition never blocks tool-generated state — non-git trees and git-absent machines skip the commit and init stays ok); `--json` only changes how the result is printed. Doc templates render `{{PROJECT_NAME}}` (target dir name) and `{{YEAR}}` at write time, and every generated file carries a `<!-- arggon:generated template="..." -->` marker as its first line. Re-run semantics are checksum-based (see [docs/convention.md](./convention.md) §Generated-doc provenance): entries flagged `acknowledged: true` (set by `adopt --ack`) are never regenerated — they land in `skipped[]` with their bytes untouched; untouched docs regenerate into `updated[]`, adopter-modified docs are skipped into `modified[]` + `skipped[]` (regenerated after `--backup`, with the old file archived to `backup/<YYYY-MM-DD>/<dest>` and listed in `backedUp[]`), so a second init on an untouched repo is `created: [], skipped: []` with every doc in `updated[]`.

### `doctor` sample (initialized repo)

```json
{
  "ok": true,
  "schemaVersion": 1,
  "conventionVersion": 3,
  "command": "doctor",
  "root": "/tmp/example-repo",
  "initialized": true,
  "docs": {
    "managed": 16,
    "untouched": 15,
    "modified": 1,
    "stale": 0,
    "missing": 0
  },
  "tracker": {
    "items": 12,
    "todo": 3
  }
}
```

Non-initialized repos return the same shape with `root: null`, `initialized: false`, zeroed `docs`/`tracker`, and `conventionVersion: 0`.

### `adopt`

Agent-assisted adoption for existing repos (see [docs/agents.md](./agents.md) §Adoption sweep): inventories the governing docs and files the agent-executable migration task `task-adopt-arggon` under a parent story (`--story <story-id>`, else `story-arggon-adoption`, auto-created under the first epic). `--dry-run` computes the full payload and writes nothing — including the default story.

| Field            | Type        | Notes                                                                                                                            |
| ---------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `taskId`         | `string`    | `task-adopt-arggon` — the created, planned (dry-run), or already-open task id                                                    |
| `storyId`        | `string`    | Parent story id (`--story` override, `story-arggon-adoption`, or the existing task's parent on an idempotent skip)                |
| `storyCreated`   | `boolean`   | `true` when this run created `story-arggon-adoption` (always `false` in dry-run and on skip)                                     |
| `createdContainers` | `string[]` | Container ids auto-created this run when the tree had no epic (fresh `init --full`): `["arggon-adoption", "epic-arggon-adoption"]`; planned ids in dry-run; `[]` when an epic existed, `--story` was passed, or on skip (additive) |
| `taskCreated`    | `boolean`   | `true` when this run created the task (always `false` in dry-run and on skip)                                                    |
| `skipped`        | `boolean`   | `true` when an open (`todo`/`in_progress`) `task-adopt-arggon` already existed and creation was skipped (idempotent re-run)       |
| `taskPath`       | `string`    | Absolute path of the created or existing task file; `"(dry run — not created)"` in dry-run when nothing exists yet               |
| `inventory`      | `object`    | Read-only doc inventory (below)                                                                                                  |
| `inventory.docs` | `object[]`  | One entry per scanned governing-doc path (standard destinations + common alternates), sorted by path                             |
| `inventory.docs[].path`    | `string`  | Posix path relative to the repo root (e.g. `AGENTS.md`, `docs/convention.md`)                                            |
| `inventory.docs[].exists`  | `boolean` | Whether the file exists on disk                                                                                          |
| `inventory.docs[].bytes`   | `number`  | File size on disk (`0` when absent)                                                                                      |
| `inventory.docs[].managed` | `boolean` | `true` when an `x-generated` provenance entry exists for the path — arggon-generated doc set (possibly edited since); an existing file without an entry is adopter-owned (content to extract) |
| `inventory.stackHints`     | `string[]`| Stack manifests found at the repo root, filename only (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`) |
| `dryRun`         | `boolean`   | `true` with `--dry-run` (plan only, no writes)                                                                                   |
| `commit`         | `object`    | Tracker auto-commit outcome for the files written this run — ONE `{ hash, message }` commit covering the task and (when created) its story, or `{ skipped: <reason> }`. Additive within `schemaVersion: 1`; absent in dry-run / when nothing was written |

Failures use `error.code: "ADOPT_FAILED"` (not an arggon-managed tree — run `arggon init` first; no epic for the default story; `--story` that does not resolve to a story; or a terminal `task-adopt-arggon`, i.e. adoption already completed).

With `--ack`, the command takes a different, standalone payload (task-adopt-checksum-refresh): it acknowledges the CURRENT on-disk content of every generated doc (each path present in `x-generated`) as the new baseline — checksums are recomputed from disk and the state entries refreshed (`arggonVersion` + current timestamp) — so the sanctioned adoption-sweep edits stop reporting as modified. It writes only `tasks/.convention.yml`, creates nothing, ignores files absent from the state, and works even when `task-adopt-arggon` is already done. Each acked entry is additionally flagged `acknowledged: true`, so later `init` re-runs never regenerate it (the acked checksum is the adopter's content, not the template render — regenerating would destroy the sanctioned edits); hand edits made AFTER an ack stay protected the same way (the file lands in `skipped[]`, never `modified[]`-overwritten); `arggon doctor` surfaces them in the informational `docs.acknowledgedDrifted` bucket.

| Field   | Type       | Notes                                                                                              |
| ------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `acked` | `object[]` | One entry per acknowledged doc, sorted by path: `{ path, checksum }` (the new `sha256:…` baseline)  |
| `count` | `number`   | `acked.length`                                                                                     |

Failures with `--ack` also use `error.code: "ADOPT_FAILED"` (only the non-initialized-tree case — the ack needs the `x-generated` state init writes).

### `list` sample (drawn from `tasks/launch-mvp`)

```json
{
  "ok": true,
  "schemaVersion": 1,
  "conventionVersion": 0,
  "command": "list",
  "items": [
    {
      "id": "task-rate-limit",
      "type": "task",
      "status": "todo",
      "title": "Add login rate limiting",
      "assignee": null,
      "parent": "story-login",
      "labels": ["security"],
      "created": "2026-09-03",
      "updated": "2026-09-03",
      "path": "tasks/launch-mvp/auth/story-login/task-rate-limit.md",
      "blocked_reason": null
    }
  ]
}
```

Empty tree: `"items": []` with `ok: true`.

### `validate` failure

```json
{
  "ok": false,
  "schemaVersion": 1,
  "conventionVersion": 0,
  "command": "validate",
  "errors": [
    {
      "path": "tasks/orphan/task-no-parent.md",
      "message": "parent does not resolve to an existing item",
      "code": "PARENT_MISSING"
    }
  ],
  "warnings": [],
  "error": {
    "message": "validate failed with 1 error(s)",
    "code": "VALIDATE_FAILED"
  }
}
```

### `init` failure

```json
{
  "ok": false,
  "schemaVersion": 1,
  "conventionVersion": 0,
  "command": "init",
  "error": {
    "message": "tasks/ exists but is missing .convention.yml. Re-run with --force to scaffold, or fix manually.",
    "code": "INIT_FAILED"
  }
}
```

---

## Implementation notes

- Formatter: `cli/src/json.ts` (`JSON_SCHEMA_VERSION`, envelope types, `emitJson`, `successJson`, `failJson`, `bindJsonProgram` + `jsonEnabled`).
- Convention version: `cli/src/convention.ts` (`CONVENTION_VERSION`, `readConventionVersion` reads `tasks/.convention.yml`).
- Domain types: `cli/src/types.ts` (`WorkItem`, `Issue`).
- Global flag: `arggon --json <command>` (before the subcommand). `arggon <command> --json` is also accepted.
