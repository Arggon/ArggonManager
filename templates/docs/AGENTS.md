# AGENTS.md

For humans and AI agents working on **{{PROJECT_NAME}}**. Work items live in-tree under `tasks/`, managed by `arggon`; GitHub is for PRs only — never open GitHub issues.

> **Use the `arggon-cli` skill by default** (`.agents/skills/arggon-cli/SKILL.md`) before any `arggon` call: `--json` contract, claim rules, pitfalls. MCP server: `.mcp.json`.

## Task workflow

1. **Find work:** `arggon next --json`; `arggon list --status todo --json` for a full scan.
2. **Claim before starting:** `arggon update <id> --status in_progress --assignee <your-login>` (or `arggon start <id> --worktree --assignee <your-login>`). Never steal a claim.
3. **One branch per item:** `arggon branch <id>`; work in a git worktree, not the primary checkout.
4. Open a small PR referencing the item id.
5. **Done** = acceptance checklist complete + `arggon update <id> --status done` + PR merged. **Never reopen** `done`/`cancelled`; file follow-ups: `arggon create task|bug "<title>" --parent <story-id>`.

### Orchestration

Delegated by default: a coordinator assigns each item to a subagent (one per worktree), planning waves by file-disjointness, and the coordinator (lead architect) **code-reviews every subagent PR before merge** — green CI is necessary, not sufficient. Verdicts land on the item via `arggon comment <item-id>` — never as GitHub PR comments (PR: CI and merge mechanics only). Subagents follow the same rules and report findings to the coordinator instead of filing tracker items.

## Docs & gates

Read before non-trivial changes: [`docs/convention.md`](docs/convention.md), [`docs/engineering.md`](docs/engineering.md), [`docs/deploy.md`](docs/deploy.md), `docs/playbooks/` (`arggon playbook status`), [`CONTRIBUTING.md`](CONTRIBUTING.md). Keep `arggon validate` green before every commit and in CI.
