# Copilot instructions

Read [AGENTS.md](../../AGENTS.md) first and follow it. It defines the task workflow (find → claim → branch → PR under `tasks/`), project docs, and gates for {{PROJECT_NAME}}.

The short version: work items live under `tasks/` — find one with `arggon list --status todo --json`, claim it with `arggon update <id> --status in_progress --assignee <your-login>`, branch with `arggon branch <id>`, and reference the item id in your PR. Never reopen done/cancelled items.
