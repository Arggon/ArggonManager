# CLI JSON output contract (schemaVersion 1)

Stable machine-readable stdout for agents and scripts. Every `--json` response is **exactly one JSON object** on stdout (plus a trailing newline).

`--json` is a **global** flag on the root program, also accepted after the subcommand:

```bash
arggon --json <command>
arggon <command> --json
```

Example: `arggon --json hello`.

The MCP server (`arggon mcp`) returns these same envelope objects as tool-result text content for its `arggon_list`, `arggon_create`, and `arggon_update` tools; kernel failures become tool errors carrying the same `ok: false` shape (see [`docs/agents.md`](./agents.md) §MCP server).

This flag is a formatter only. It does not walk `tasks/` or parse frontmatter. Commands that load domain objects pass those objects to the formatter. Human vs JSON printing lives in the CLI entrypoint.

---

## Envelope

Every success or failure payload includes:

| Field               | Type    | Notes                                                                                                                                 |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ok`                | boolean | `true` on success; `false` on failure                                                                                                 |
| `schemaVersion`     | number  | JSON **output** contract version. Currently **`1`**. Not the task-tree convention version.                                            |
| `conventionVersion` | number  | From `tasks/.convention.yml` (`version`). Omit file = **`0`**.                                                                        |
| `command`           | string  | Commander command name: `hello` \| `init` \| `list` \| `validate` \| `create` \| `update` \| `branch` \| `start` \| `board` \| `sync` |

Command-specific fields sit next to this envelope (not nested under a generic `data` key).

### Compatibility

- **Additive** fields are OK within a `schemaVersion`.
- **Breaking** changes bump `schemaVersion`.
- Clients **MUST ignore** unknown fields.
- This CLI emits **`schemaVersion: 1` only**.
- Distinct from the convention **tree** version in [`docs/convention.md`](./convention.md). A v0 tree with JSON schema 1 is `{ schemaVersion: 1, conventionVersion: 0 }`; a v1 tree (with `branch`) reports `conventionVersion: 1`; a v2 tree (with `branch_patterns`) reports `conventionVersion: 2`.

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

Stable fields aligned with convention v0 plus the additive v1 `branch`. **Always present** so agents need not special-case missing keys:

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

Enums match [`docs/convention.md`](./convention.md) v0.

### `Issue`

```ts
{ path: string, message: string, code: string }
```

`path` is posix, relative to the repo/tree root.

---

## Command payloads

`list` / `validate` / `create` / `update` are specified here so those commands can emit the same envelope later. **This PR does not implement those commands.**

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
| `created`            | `string[]` | Paths created/overwritten this run (posix, relative to `root`)                  |
| `restored`           | `string[]` | Missing templates restored when already initialized (posix, relative to `root`) |

### `list` (contract; command may land later)

| Field   | Type         | Notes                                 |
| ------- | ------------ | ------------------------------------- |
| `items` | `WorkItem[]` | Lexicographic by `id`, per convention |

### `validate` (contract; command may land later)

| Field      | Type      | Notes |
| ---------- | --------- | ----- |
| `errors`   | `Issue[]` |       |
| `warnings` | `Issue[]` |       |

`ok` is `false` **iff** `errors.length > 0` (warnings alone keep `ok: true`). When `ok` is false, the envelope still includes `error` so generic clients can branch on one field.

### `create` / `update` (contract; commands may land later)

| Field  | Type       |
| ------ | ---------- |
| `item` | `WorkItem` |

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

Failures use `error.code: "START_FAILED"` (unknown id, taken claim — never forced, dirty tree, existing branch, non-git tree, or gh failure).

### `next`

| Field                    | Type             | Notes                                                          |
| ------------------------ | ---------------- | -------------------------------------------------------------- |
| `suggestion`             | `object \| null` | One suggestion object, or `null` when the todo pool is empty   |
| `suggestion.item`        | `WorkItem`       | Suggested unclaimed todo (claimable type, lexicographic by id) |
| `suggestion.parentChain` | `string[]`       | Parent ids root-first                                          |
| `suggestion.reason`      | `string`         | Why this item was chosen                                       |

Empty pool is success (`ok: true`, `suggestion: null`). Failures use `error.code: "NEXT_FAILED"` (missing tasks/, unreadable items).

### `report`

| Field                 | Type                  | Notes                                                            |
| --------------------- | --------------------- | ---------------------------------------------------------------- |
| `groups`              | `object[]`            | One entry per epic, lexicographic by id (same rows as the table) |
| `groups[].epic`       | `{id, title}`         | The epic                                                         |
| `groups[].initiative` | `{id, title} \| null` | Parent initiative (null when absent)                             |
| `groups[].containers` | `object[]`            | One entry per story: `{id, title, type, counts, empty}`          |
| `groups[].totals`     | `counts`              | Sums over the epic's stories                                     |
| `groups[].empty`      | `boolean`             | True when the epic has no stories                                |

`counts` always carries all five statuses (`todo`, `in_progress`, `blocked`, `done`, `cancelled` — cancelled explicit, never lumped) plus `total`. Leafless stories report zeros with `empty: true`. Display-only: never writes. Failures use `error.code: "REPORT_FAILED"` (missing tasks/, unreadable items).

Human output supports `--format table` (default) and `--format markdown` (standup summary: per-epic progress lines with `(done + cancelled)/total` completion, plus a Blocked section listing each leaf's `blocked_reason`). Markdown is stdout-only (not part of the JSON contract); both formats are pure tree reads — no network, no GitHub calls.

### `board`

| Field       | Type      | Notes                                                      |
| ----------- | --------- | ---------------------------------------------------------- |
| `path`      | `string`  | Output HTML path (display form)                            |
| `itemCount` | `number`  | Items rendered                                             |
| `github`    | `boolean` | Present and `true` only with `--github`                    |
| `prCount`   | `number`  | PRs matched to card branches; present only with `--github` |

With `--github` the board overlays live PR state (number, draft/ready, checks) on cards with a `branch`, matched by head ref name; cards without a branch or PR get a neutral badge. Without the flag the board is a fully offline snapshot. Failures use `error.code: "BOARD_FAILED"` (missing tasks/, or without gh auth — run plain `board` for the offline snapshot).

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
    "tasks/.convention.yml",
    "templates/bug.md",
    "templates/epic.md",
    "templates/initiative.md",
    "templates/story.md",
    "templates/task.md"
  ],
  "restored": []
}
```

Init still **writes** `tasks/.convention.yml` and `templates/`; `--json` only changes how the result is printed.

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
