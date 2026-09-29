---
type: task
status: done
id: task-zcode-board-command
title: Ship /arggon-board in the ZCode seam (ADR 0014 board substitute)
assignee: Arggon
branch: feat/task-zcode-board-command
parent: native-zcode-integration
labels: []
created: "2026-09-29"
updated: "2026-09-29"
worktree_path: /home/arggon/Projects/ArggonManager-task-zcode-board-command
---
<!--
  Placement (v0): ArggonManager/arggon-manager/zcode-native-arggonmanager-mcp-parity-plugin-seam/native-zcode-integration/task-zcode-board-command.md
  Leaves live only under a story. id is the filename stem: task-zcode-board-command.
  CLI `arggon create task zcode-board-command` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Ship /arggon-board in the ZCode seam (ADR 0014 board substitute)

# Ship /arggon-board in the ZCode seam (ADR 0014 board substitute)

## Context

Discovered while closing out the zcode-native program: ADR 0014's
Consequences promise the TUI board panel's substitute — "serving the board
over HTTP (`arggon board --serve`)" — but the ZCode seam ships only the
eleven workflow commands; nothing surfaces the board. OpenCode gets the
panel from its plugin's TUI entry; ZCode has neither panel nor command, so
the documented substitute does not exist in the generated seam.

## Acceptance

- [x] `templates/docs/zcode/arggon/commands/arggon-board.md`: instructs the
      agent to run `arggon board --serve` in the background, parse the
      one-shot serving envelope (`serving: true`, loopback `url`, `port`)
      and hand the user the URL as a markdown link; warns the server runs
      until stopped
- [x] Seam tests updated: 12 commands (`init-zcode.test.ts`), tier-1 exact
      set extended (`init.test.ts`)
- [x] `docs/agents.md` §ZCode and the ADR 0014 consequence updated
      (eleven → twelve; the substitute is shipped, not just promised)
- [x] Gates green; `arggon validate --json` ok:true before every commit
