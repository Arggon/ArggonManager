# ArggonManager

**Git-native project management for builders and agents.**

Tasks live *inside* the repository as Markdown. Create a file, open a branch, update YAML — the whole team (and any agent) stays in sync. No separate board to drift out of date.

> **Status:** early design — convention + CLI first.

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

| Phase | Deliverable |
| --- | --- |
| **1** | Folder + frontmatter **convention** and templates |
| **1** | **CLI** to create, list, and update tasks |
| **2** | Viewer / board UI over the tree |
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
- [Engineering conventions](docs/engineering.md) — repo structure, review bar, testing, ADRs (Phase 1)
- Sample tree: [`tasks/launch-mvp/`](tasks/launch-mvp/)

## Templates

v0 stubs (YAML frontmatter + Context / Acceptance / Notes) live in [`templates/`](templates/):

- [`templates/initiative.md`](templates/initiative.md)
- [`templates/epic.md`](templates/epic.md)
- [`templates/story.md`](templates/story.md)
- [`templates/task.md`](templates/task.md)
- [`templates/bug.md`](templates/bug.md)

Copy a stub into `tasks/` per [`docs/convention.md`](docs/convention.md). Future CLI `arggon create` should copy from these templates.

## CLI (Phase 1 scaffold)

Requires **Node.js 20+**. Stack: [docs/adr/0001-cli-stack.md](docs/adr/0001-cli-stack.md) (ADR 0001 Accepted with this scaffold).

Root install; TypeScript in cli/:

```bash
npm install
npm run arggon -- hello
npm run arggon -- init /path/to/repo
npm run build
npm test
npm run lint
```

`arggon init` creates `tasks/.convention.yml` and copies `templates/` (no overwrite unless `--force`; already-initialized repos are a no-op).

Fixtures: [fixtures/](fixtures/).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Ideas on folder layout, frontmatter schema, and CLI UX are especially useful right now. Open an issue. Please follow the [task convention](docs/convention.md) when proposing sample trees or templates.

## License

MIT — see [LICENSE](LICENSE).

---

Built in the open by [Arggon](https://github.com/Arggon).