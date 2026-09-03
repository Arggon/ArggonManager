# Task convention (v0)

ArggonManager stores work as Markdown files under `tasks/`. Humans and agents create, claim, and update items the same way: edit the file and commit.

**v0 fields and layout are locked.** Unknown frontmatter keys are allowed for forward compatibility; validators may warn but must not fail on them in v0.

This document is the source of truth for future CLI behavior (`validate`, `create`, `update`, claim rules). CLI implementation is out of scope for this convention PR.

---

## Folder layout

```text
tasks/
  <initiative-slug>/
    <initiative-slug>.md          # REQUIRED index
    <epic-slug>/
      <epic-slug>.md              # REQUIRED index
      <story-slug>/
        <story-slug>.md           # REQUIRED index
        task-<slug>.md
        bug-<slug>.md
```

### Hierarchy

| Level | Directory | Index file | Children |
| --- | --- | --- | --- |
| Initiative | `tasks/<initiative-slug>/` | `<initiative-slug>.md` | epic directories |
| Epic | `.../<epic-slug>/` | `<epic-slug>.md` | story directories |
| Story | `.../<story-slug>/` | `<story-slug>.md` | `task-*.md`, `bug-*.md` |
| Task / Bug | *(files only)* | n/a | none |

In **v0**, tasks and bugs live **only** under a story. They must not sit directly under an epic or initiative.

### Slug rules

- Format: kebab-case ASCII — lowercase letters, digits, hyphens only
- Pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Max length: **64** characters
- The slug must match the item’s `id` field (see below)

### File naming vs `id`

| Item | Filename | `id` value |
| --- | --- | --- |
| Initiative / epic / story index | `<slug>.md` | `<slug>` |
| Task | `task-<slug>.md` | `task-<slug>` |
| Bug | `bug-<slug>.md` | `bug-<slug>` |

Examples: initiative `launch-mvp` → file `launch-mvp.md`, `id: launch-mvp`. Task → file `task-rate-limit.md`, `id: task-rate-limit`.

### Moving items

1. `git mv` the file and/or directory to the new parent path.
2. Update `parent` on the moved item to the new parent’s `id`.
3. If you move a container (story/epic), update `parent` on every child that still points at the old location (and any nested children’s parents as needed).

### Invalid layouts (reject / fail validate)

| Problem | Why invalid |
| --- | --- |
| Missing index `.md` in an initiative/epic/story directory | Every container needs a required index |
| `task-*.md` or `bug-*.md` directly under epic or initiative | Tasks/bugs only under story in v0 |
| Filename prefix does not match type (`task-` / `bug-` / bare slug for indexes) | Naming must match type and `id` |
| Filename slug ≠ `id` | Identity must be consistent |
| Slug not kebab-case / > 64 chars / non-ASCII | Breaks path and id rules |
| Epic/story/task/bug without `parent` | Parent required except for initiatives |
| Initiative with a non-null `parent` | Initiatives are roots |
| Extra non-convention files that claim to be work items | Keep the tree unambiguous |

---

## Frontmatter schema (v0)

Every work item file begins with YAML frontmatter between `---` fences.

### Fields

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | **yes** | enum | `initiative` \| `epic` \| `story` \| `task` \| `bug` |
| `status` | **yes** | enum | see [Statuses](#statuses-v0) |
| `id` | **yes** | string | Must match filename rules above |
| `title` | no | string | If omitted, derive from the first Markdown H1 |
| `assignee` | no | string \| null | GitHub login or agent id |
| `parent` | conditional | string \| null | **Required** for epic/story/task/bug; omit or `null` for initiative |
| `labels` | no | list of strings | Default `[]` |
| `created` | no | ISO-8601 date | Prefer `YYYY-MM-DD`; datetime also fine |
| `updated` | no | ISO-8601 date | Prefer `YYYY-MM-DD`; datetime also fine |
| `blocked_reason` | no | string | Meaningful when `status` is `blocked` |

### Defaults when creating

| Field | Default |
| --- | --- |
| `status` | `todo` |
| `created` | today |
| `updated` | today |
| `labels` | `[]` |
| `assignee` | unset / null |
| `title` | unset (derive from H1) |

### Unknown fields

Unknown keys are **allowed** (forward-compatible). Validators may **warn** but must **not fail** validation solely because of unknown keys in v0.

### Minimal examples

**Initiative**

```yaml
---
type: initiative
status: in_progress
id: launch-mvp
title: Launch MVP
labels: [phase-1]
created: 2026-09-03
updated: 2026-09-03
---
```

**Epic** (parent required)

```yaml
---
type: epic
status: todo
id: auth
parent: launch-mvp
created: 2026-09-03
updated: 2026-09-03
---
```

**Story**

```yaml
---
type: story
status: todo
id: story-login
parent: auth
created: 2026-09-03
updated: 2026-09-03
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
created: 2026-09-03
updated: 2026-09-03
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
created: 2026-09-03
updated: 2026-09-03
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
| `done` | *(terminal)* — reopen only via `todo` with **explicit human intent** (exceptional) |
| `cancelled` | *(terminal)* — same exceptional reopen rule as `done` |

Changing status means editing frontmatter and committing (or opening a PR). Agents follow the same transitions.

### Claim rule

Moving to `in_progress` **requires** `assignee` to be set (GitHub login or agent id).

**Claim** = `assignee` set **and** `status: in_progress`.

Unclaim: `in_progress` → `todo` and clear or leave `assignee` as team policy dictates; v0 only requires that `in_progress` always has an assignee.

Full claim concurrency / conflict handling is deferred to a later issue (#16).

### `blocked_reason`

When `status` is `blocked`, set `blocked_reason` to a short human-readable string (also fine to elaborate in the body). Clearing the block should return to `in_progress` (with assignee still set) or `cancelled`.

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

## Sample tree

See [`tasks/launch-mvp/`](../tasks/launch-mvp/) for a small valid v0 example (initiative → epics → stories → tasks/bugs).
