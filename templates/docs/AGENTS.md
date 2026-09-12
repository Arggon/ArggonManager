# AGENTS.md

Instructions for humans and AI agents working on **{{PROJECT_NAME}}**. Read this file before writing any code.

## What this project is

<!-- Describe the project in one or two sentences: what it does, for whom, and its core constraint. -->

{{PROJECT_NAME}} — <!-- TODO: one-sentence project description -->.

## Task workflow

Work items live in-tree under `tasks/` (Markdown + YAML frontmatter), managed by `arggon`. GitHub is for PRs only — do not open GitHub issues.

> **Use the `arggon-cli` skill by default.** This repo bundles it at `.agents/skills/arggon-cli/SKILL.md`. Load it before any `arggon` invocation: it defines the JSON contract (`--json`), the claim rules, and the command pitfalls. Do not guess flags from memory.

1. **Find work:** `arggon list --status todo --json`
2. **Claim before starting:** `arggon update <id> --status in_progress --assignee <your-login>` (or `arggon start <id> --worktree --assignee <your-login>` to claim + create a worktree). Never set `in_progress` without an assignee; never steal a claim.
3. **One branch per item:** `arggon branch <id>` → `feat/<id>` / `fix/<id>`. Work in a git worktree, not the primary checkout.
4. **Open a PR** referencing the work item id in the title or body. Keep PRs small.
5. **Done** = acceptance checklist in the item body complete + `arggon update <id> --status done` + PR merged.
6. **Never reopen** `done`/`cancelled` items. File follow-ups instead: `arggon create task|bug "<title>" --parent <story-id>`.

## Project docs

Read these before non-trivial changes (if present in this repo):

- [`docs/convention.md`](docs/convention.md) — tasks/ tree layout and frontmatter schema.
- [`docs/engineering.md`](docs/engineering.md) — review bar, testing, definition of done.
- `docs/playbooks/` — technology playbooks: follow them for the current pinned versions and best practices; check `arggon playbook status` and refresh playbooks when they go stale.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branch, commit, and PR rules.

## Gates

These checks run before code lands; keep them green.

<!-- Pre-commit gate: reject commits with an invalid tasks/ tree.
     .git/hooks/pre-commit (make executable):
       #!/bin/sh
       arggon validate
-->

<!-- CI gate: add a job to your workflow.
       - run: arggon validate
-->
