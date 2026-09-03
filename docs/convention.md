# Task convention (v0)

ArggonManager stores work as Markdown files under `tasks/`. Humans and agents create, claim, and update items the same way: edit the file and commit.

**v0 fields and layout are locked.** See [Versioning](#versioning--forward-compatibility) for how unknown keys and future versions work.

This document is the source of truth for future CLI behavior (`validate`, `create`, `update`, claim rules). CLI implementation is out of scope for this convention PR.

---

## Folder layout

```text
tasks/
  .convention.yml                 # tree version (optional; omit = 0)
  <initiative-id>/
    <initiative-id>.md            # REQUIRED index
    <epic-id>/
      <epic-id>.md                # REQUIRED index
      <story-id>/
        <story-id>.md             # REQUIRED index
        task-<inner-slug>.md
        bug-<inner-slug>.md
```

### Hierarchy

| Level | Directory | Index file | Children |
| --- | --- | --- | --- |
| Initiative | `tasks/<initiative-id>/` | `<initiative-id>.md` | epic directories |
| Epic | `.../<epic-id>/` | `<epic-id>.md` | story directories |
| Story | `.../<story-id>/` | `<story-id>.md` | `task-*.md`, `bug-*.md` |
| Task / Bug | *(files only)* | n/a | none |

In **v0**, tasks and bugs live **only** under a story. They must not sit directly under an epic or initiative.

Parent `status` is **independent** of children — **no rollup** in v0. Container status is authored, not derived.

### Vocabulary: `id`, inner slug, filename

| Term | Meaning |
| --- | --- |
| `id` | Canonical identifier = **filename stem** (no `.md`). **Globally unique** under `tasks/`. |
| inner slug | Leaves only: `id` with the `task-` / `bug-` prefix stripped. |
| filename | Function of `type` + `id`, never an independent namespace. |

Rules:

- Max length **64** characters applies to **`id`** (the stem), not the inner slug alone.
- `id` pattern (stem): `^[a-z0-9]+(?:-[a-z0-9]+)*$` (kebab-case ASCII).
- Container ids (**initiative / epic / story**) **MUST NOT** start with `task-` or `bug-`.
- Type prefixes on stories (e.g. `story-login`) are **not** type discriminators — type lives in `type` + path. A prefix may appear inside the id as style only.
- `id` is **not** a stable UUID: **rename = new identity**.

CLI create examples:

| Command | Resulting `id` / filename |
| --- | --- |
| `arggon create task rate-limit …` | `id: task-rate-limit`, file `task-rate-limit.md` (CLI adds `task-` / `bug-` for leaves) |
| `arggon create epic auth …` | `id: auth`, file `auth.md` (no type prefix) |
| `arggon create story story-login …` | `id: story-login` (caller chose the stem; `story-` is not required) |

### Filename vs `id`

| Item | Filename | `id` value |
| --- | --- | --- |
| Initiative / epic / story index | `<id>.md` | `<id>` |
| Task | `task-<inner-slug>.md` | `task-<inner-slug>` |
| Bug | `bug-<inner-slug>.md` | `bug-<inner-slug>` |

### Reparent vs rename

| Operation | What to update |
| --- | --- |
| **Reparent** (move dir/file, **same** `id`) | Only the moved item’s `parent` (+ filesystem path). **Children untouched.** |
| **Rename** (change `id` / directory name) | Filename/dir, the item’s `id`, and **every** `parent` that referenced the old `id`. |

`parent` is an **id**, not a path. Moving `story-login/` from under `auth/` to under `onboarding/` updates only that story’s `parent` (`auth` → `onboarding`). Nested tasks keep `parent: story-login`.

### Invalid layouts (reject / fail validate)

| Problem | Why invalid |
| --- | --- |
| Missing index `.md` in an initiative/epic/story directory | Every container needs a required index |
| `task-*.md` or `bug-*.md` directly under epic or initiative | Tasks/bugs only under story in v0 |
| Filename does not match `type` + `id` rules | Naming must match type and identity |
| Filename stem ≠ `id` | Identity must be consistent |
| `id` not kebab-case / > 64 chars / non-ASCII | Breaks path and id rules |
| Container `id` starts with `task-` or `bug-` | Reserved leaf prefixes |
| Epic/story/task/bug without `parent` | Parent required except for initiatives |
| Initiative with a non-null `parent` | Initiatives are roots |
| **`id` not unique** under entire `tasks/` tree | `parent` and lookup-by-id must be unambiguous |
| **`parent` does not resolve** to an existing item | No dangling references |
| **`parent` type vs child type** mismatch | Allowed edges only: epic→initiative, story→epic, task/bug→story. No skip, no cycles |
| **`parent` ≠ filesystem parent container’s `id`** | Path and frontmatter are the **same** hierarchy |
| **`type` ≠ path role** | e.g. index in an epic directory must be `type: epic` |
| Unknown directories under a story | Only index + `task-*.md` / `bug-*.md` allowed in v0 |

**Work-item detection:** any `*.md` under `tasks/` whose frontmatter has `type:` is a work item and must satisfy naming + placement. Other files (`README`, images, `.convention.yml`) are ignored by `validate`.

---

## Frontmatter schema (v0)

Every work item file begins with YAML frontmatter between `---` fences.

### Fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | **yes** | enum | `initiative` \| `epic` \| `story` \| `task` \| `bug` |
| `status` | **yes** | enum | see [Statuses](#statuses-v0) |
| `id` | **yes** | string | Filename stem; globally unique under `tasks/`; rename = new identity |
| `title` | no | string | Canonical when present; else first Markdown H1; else display `id`. `list` does **not** rewrite the file |
| `assignee` | no | string \| null | Omit or `null` = unassigned; **empty string is invalid**. Pattern: `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$` (GitHub login or agent id) |
| `parent` | conditional | string \| null | **Required** for epic/story/task/bug; omit or `null` for initiative. Must equal filesystem parent container’s `id` |
| `labels` | no | list of strings | Default `[]`. Kebab-case ASCII, unique, case-sensitive (no folding) |
| `created` | no | string | Quoted `YYYY-MM-DD` only in v0 (e.g. `created: "2026-09-03"`) |
| `updated` | no | string | Quoted `YYYY-MM-DD` only in v0 |
| `blocked_reason` | conditional | string | **Required non-empty** when `status: blocked`; must be **absent or empty** otherwise |

### Defaults when creating

| Field | Default |
| --- | --- |
| `status` | `todo` |
| `created` | today (`"YYYY-MM-DD"`) |
| `updated` | today (`"YYYY-MM-DD"`) |
| `labels` | `[]` |
| `assignee` | omit / null |
| `title` | unset (derive from H1) |

### Minimal examples

**Initiative** (may be `in_progress` without assignee)

```yaml
---
type: initiative
status: in_progress
id: launch-mvp
title: Launch MVP
labels: [phase-1]
created: "2026-09-03"
updated: "2026-09-03"
---
```

**Epic** (parent required; may be `in_progress` without assignee)

```yaml
---
type: epic
status: todo
id: auth
parent: launch-mvp
created: "2026-09-03"
updated: "2026-09-03"
---
```

**Story**

```yaml
---
type: story
status: todo
id: story-login
parent: auth
created: "2026-09-03"
updated: "2026-09-03"
---
```

**Task**

```yaml
---
type: task
status: todo
id: task-rate-limit
parent: story-login
labels: [security]
created: "2026-09-03"
updated: "2026-09-03"
---
```

**Bug**

```yaml
---
type: bug
status: todo
id: bug-empty-password-500
parent: story-login
labels: [bug]
created: "2026-09-03"
updated: "2026-09-03"
---
```

Body content after frontmatter is free-form Markdown (context, acceptance criteria, notes). Convention tools treat the body as opaque except for optional H1 title derivation.

---

## Statuses (v0)

### Enum

`todo` | `in_progress` | `blocked` | `done` | `cancelled`

### Transition matrix

| From | Allowed next |
| --- | --- |
| `todo` | `in_progress`, `cancelled` |
| `in_progress` | `blocked`, `done`, `cancelled`, `todo` (unclaim) |
| `blocked` | `in_progress`, `cancelled` |
| `done` | `todo` (reopen — schema allows; see playbook) |
| `cancelled` | `todo` (reopen — schema allows; see playbook) |

Intentional gaps: **`todo` ↛ `done`** and **`todo` ↛ `blocked`** — completing or blocking requires a claim first.

Changing status means editing frontmatter and committing (or opening a PR). Agents follow the same transitions except where playbook forbids reopen.

### Claim rule

Claim applies **only** to claimable types: **`story` | `task` | `bug`**.

- For those types, `status: in_progress` **requires** non-null `assignee`.
- **Initiative** and **epic** MAY be `in_progress` **without** assignee (authored container status, not rollup).

**Claim** = (`type` ∈ {story, task, bug}) ∧ `assignee` set ∧ `status: in_progress`.

### Unclaim (v0 CLI `update` default)

`in_progress` → `todo` **clears** `assignee` to null (omit or `null`). Documented as the CLI `update` default.

### Reopen / status policy

- **`validate` ALLOWS** `done|cancelled` → `todo` (schema permits).
- **Playbook:** agents **MUST NOT** reopen; humans may via documented escape hatch (`arggon reopen` / `--force`).
- No status rollup — parent status is independent of children.

Full claim concurrency / conflict handling is deferred to a later issue (#16).

### `blocked_reason`

When `status` is `blocked`, `blocked_reason` MUST be a non-empty short human-readable string (elaborate in the body if needed). When status is not `blocked`, `blocked_reason` MUST be absent or empty. Clearing the block should return to `in_progress` (with assignee still set on claimable types) or `cancelled`.

### Status examples

```yaml
status: todo
```

```yaml
status: in_progress
assignee: arggon
```

```yaml
status: blocked
assignee: arggon
blocked_reason: Waiting on OAuth app credentials from ops
```

```yaml
status: done
assignee: arggon
```

```yaml
status: cancelled
```

---

## Versioning & forward compatibility

### Tree version

Add `tasks/.convention.yml`:

```yaml
version: 0
```

Omit = `0`. Layout is a tree concern. Per-file schema is optional and defaults to the tree version.

### Extension namespace

- Official keys = the field table above.
- Reserved extension namespace: `x-*` keys (or an `extensions:` map).
- Unknown **namespaced** keys: ignore-unknown (do not fail).
- Unknown **unnamespaced** keys: validators may **warn**.
- Official tools **must round-trip** unknown namespaced keys on `update` (do not strip).

### Reserved for later (invalid as ad-hoc in v0)

These names are reserved for a future version — do not invent them as unknown keys with meaning:

`order` / `rank`, `depends_on` / `blocked_by`, `priority`, `estimate`

### v0 → v1

- Additive fields default safely.
- Breaking changes bump `version`.
- v0 `validate` **rejects** trees with a higher convention version.

### Listing order (v0)

Lexicographic by `id`.

### Parent status

Independent of children — **no rollup** in v0.

---

## Sample tree

See [`tasks/launch-mvp/`](../tasks/launch-mvp/) for a small valid v0 example (initiative → epics → stories → tasks/bugs), plus [`tasks/.convention.yml`](../tasks/.convention.yml).
