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

**Convention (v0) is locked.** See [`docs/convention.md`](docs/convention.md) for folder layout, frontmatter schema, statuses, and claim rules. A sample tree lives under [`tasks/`](tasks/).

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
assignee:
parent: story-login
labels: [security]
created: 2026-09-03
updated: 2026-09-03
---

# Add login rate limiting

## Context
...

## Acceptance
- [ ] ...
```

Exact v0 fields are documented in [`docs/convention.md`](docs/convention.md) (layout, schema, and status transitions are locked).

## Contributing

Ideas on folder layout, frontmatter schema, and CLI UX are especially useful right now. Open an issue. Please follow the [task convention](docs/convention.md) when proposing sample trees or templates.

## License

TBD — OSI-approved license before a public release.

---

Built in the open by [Arggon](https://github.com/Arggon).
