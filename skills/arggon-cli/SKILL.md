---
name: arggon-cli
description: Operate the ArggonManager git-native task CLI with JSON output.
version: 0.1.0
author: Arggon (Arggon), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [CLI, Tasks, Agents, JSON]
    related_skills: []
---

# Arggon CLI Skill

Drive the `arggon` task CLI (tasks live as Markdown under `tasks/`). This skill covers invocation and machine-readable output; the human/agent workflow (find → claim → work → PR) lives in `docs/agents.md`.

## When to Use

- Listing, creating, claiming, updating, validating, or visualizing work items in a repo with `tasks/.convention.yml`.
- Any task that ends with "update the task status" or "check the board".
- Don't use for: editing convention rules (`docs/convention.md` is source of truth) or Phase 2+ UI work.

## Prerequisites

- Node.js 20+ and the ArggonManager checkout built (`npm install` once).
- Invoke via `terminal`: `node dist/cli.js <command>` from anywhere inside the target repo (the CLI walks up to find `tasks/`). `npm run arggon -- <command>` from the package root works too but is slower.

## How to Run

- Prefer ONE `--json` call per need and parse stdout as JSON. Batch independent calls in the same turn.
- Human output (no `--json`) works for quick scans but never parse it — re-run with `--json` for machine use.
- Global flag, either position: `arggon --json <command>` or `arggon <command> --json`.
- Success envelope: `{ok: true, schemaVersion: 1, conventionVersion, command, ...payload}`. Failure: `{ok: false, ..., error: {message, code}}` with non-zero exit. Never mix human text into stdout when `--json` is set.
- Per-command error codes: `INIT_FAILED`, `CREATE_FAILED`, `LIST_FAILED`, `UPDATE_FAILED`, `VALIDATE_FAILED`, `BOARD_FAILED`.

## Quick Reference

```bash
node dist/cli.js list --status todo --json                          # find work
node dist/cli.js list --type bug --assignee @me --json               # @me via GITHUB_USER, GITHUB_ACTOR, then `gh api user`
node dist/cli.js update <id> --status in_progress --assignee <login> # claim
node dist/cli.js create task "Title" --parent <story-id>             # new work (status defaults to todo)
node dist/cli.js create bug "Title" --parent <story-id> --json
node dist/cli.js update <id> --status done                           # complete
node dist/cli.js update <id> --status blocked --blocked-reason "..." # blocked (reason required)
node dist/cli.js update <id> --status todo                           # unclaim (clears assignee)
node dist/cli.js validate --json                                     # ok:false iff errors.length > 0; warnings alone keep ok:true
node dist/cli.js board --json                                        # {path, itemCount}; HTML defaults to repo root
node dist/cli.js board --github --json                             # + live PR overlay {github, prCount}; needs gh auth
node dist/cli.js next --json                                         # {suggestion: {item, parentChain, reason} | null}
node dist/cli.js report --json                                       # {groups} per-epic leaf counts; display only
```

## Procedure

1. **Locate work:** `list --status todo --json`. Completion: `ok:true` and an `items` array (possibly empty — empty is success, not an error).
2. **Start:** `start <id> --assignee <login> [--open-pr]` — claims (`in_progress` + assignee), checks out the working branch (pattern or recorded field), commits the claim, pushes, and with `--open-pr` opens a draft PR with the item id in the body. Completion: `ok:true` with `branch` + `pushed:true` (`prUrl` with `--open-pr`). If the claim is taken (`START_FAILED`), pick another item — never `--force`. Manual fallback: `update <id> --status in_progress --assignee <login>` + `branch <id>`.
3. **Record findings:** `create task|bug "<title>" --parent <story-id>`. Completion: returned `item.id` + `path` under the parent story. Leaves get the `task-`/`bug-` prefix automatically (even with `--id`).
4. **Finish:** complete the acceptance checklist in the Markdown body, then `update <id> --status done`. Never jump `todo` → `done`, never reopen `done`/`cancelled`.
5. **Verify:** `validate --json` must show `ok:true` before committing.

## Pitfalls

- `update --labels a,b` REPLACES the full labels list; labels must be kebab-case, unique (validated server-side).
- `in_progress` on a claimable type without `assignee` is rejected; initiatives/epics may be `in_progress` unassigned.
- `update --status blocked` without `--blocked-reason` is rejected; `blocked_reason` must be absent otherwise.
- `WorkItem.path` in JSON is posix, relative to the repo root (not cwd).
- `board` without `--out` writes `board.html` at the repo root (where `tasks/` lives), wherever you run it; explicit `--out` resolves from cwd and parent dirs must exist.
- `board --github` overlays live PR state on cards with a `branch` (one `gh pr list` read, matched by head ref name; neutral badge without branch or PR); without gh auth it fails suggesting plain `board`. Never writes to `tasks/` in any path.
- `list` filters compose with AND; unknown `--status`/`--type` values fail instead of returning empty.
- Run inside the repo tree: outside it every command fails fast (e.g. `LIST_FAILED`) — `cd` into the repo first.
- Conventions can evolve: check `conventionVersion` in any envelope; v0 rules are in `docs/convention.md`.

## Verification

- `node dist/cli.js validate --json` → `{"ok": true, ...}` on a healthy tree; on a broken tree expect `ok:false` + `error.code: "VALIDATE_FAILED"` + non-zero exit — fix the tree, don't work around it.
- `node dist/cli.js board --json` → `{"ok": true, "command": "board", "path": "<root>/board.html", ...}` and the file exists.
