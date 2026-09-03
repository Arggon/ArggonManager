# CLI JSON output contract (schemaVersion 1)

Stable machine-readable stdout for agents and scripts. Every `--json` response is **exactly one JSON object** on stdout (plus a trailing newline).

`--json` is a **global** flag on the root program:

```bash
arggon --json <command>
```

Example: `arggon --json hello`.

This flag is a formatter only. It does not walk `tasks/` or parse frontmatter. Commands that load domain objects pass those objects to the formatter. Human vs JSON printing lives in the CLI entrypoint.

---

## Envelope

Every success or failure payload includes:

| Field               | Type    | Notes                                                                                          |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `ok`                | boolean | `true` on success; `false` on failure                                                          |
| `schemaVersion`     | number  | JSON **output** contract version. Currently **`1`**. Not the task-tree convention version.     |
| `conventionVersion` | number  | From `tasks/.convention.yml` (`version`). Omit file = **`0`**.                                 |
| `command`           | string  | Commander command name: `hello` \| `init` \| `list` \| `validate` \| `create` \| `update` \| … |

Command-specific fields sit next to this envelope (not nested under a generic `data` key).

### Compatibility

- **Additive** fields are OK within a `schemaVersion`.
- **Breaking** changes bump `schemaVersion`.
- Clients **MUST ignore** unknown fields.
- This CLI emits **`schemaVersion: 1` only**.
- Distinct from the convention **tree** version in [`docs/convention.md`](./convention.md). A v0 tree with JSON schema 1 is `{ schemaVersion: 1, conventionVersion: 0 }`.

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

Stable fields aligned with convention v0. **Always present** so agents need not special-case missing keys:

| Field            | Type                                                          | Notes                                                                       |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `id`             | `string`                                                      | Filename stem                                                               |
| `type`           | `initiative` \| `epic` \| `story` \| `task` \| `bug`          |                                                                             |
| `status`         | `todo` \| `in_progress` \| `blocked` \| `done` \| `cancelled` |                                                                             |
| `title`          | `string` \| `null`                                            | Canonical title when known                                                  |
| `assignee`       | `string` \| `null`                                            |                                                                             |
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

- Formatter: `cli/src/json.ts` (`JSON_SCHEMA_VERSION`, envelope types, `emitJson`, `failJson`, `jsonEnabled`).
- Domain types: `cli/src/types.ts` (`WorkItem`, `Issue`).
- Global flag: `arggon --json <command>` (before the subcommand). `arggon <command> --json` is also accepted.
