# 0002 Board viewer v0

- Status: Proposed
- Date: 2026-09-07
- Deciders: Software Developer (author), Software Architect (review), Project Manager (aware)

## Context

Epic [#19](https://github.com/Arggon/ArggonManager/issues/19) (Phase 2) asks for a read-only board over the git-native `tasks/` tree. [`docs/viewer-spike.md`](../viewer-spike.md) locked the constraints — git files stay the source of truth, no schema fork, reuse the CLI read path — and required an ADR before viewer work lands. Phase 1 (convention, CLI, validate, claim rules) is complete and stable, so Phase 2 is unblocked.

The spike left the stack open: framework choice, package layout, local vs hosted.

## Decision

Ship viewer v0 as a **`arggon board` subcommand inside the existing `cli/` package** that writes a **self-contained static HTML file** (default `board.html` in the working directory).

| Choice    | Value                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| Delivery  | `arggon board [--out <file>]` — no new top-level package                                                    |
| Output    | One static HTML file; zero client JS, zero runtime deps beyond the CLI                                      |
| Read path | Shared kernel (`loadItems`) mapped to the `WorkItem` contract — the same data `arggon list --json` emits    |
| Rendering | Columns = v0 statuses in enum order; cards show type, id, title, assignee, labels, `blocked_reason`, parent |
| Writes    | None — the board is generated, read-only, and safe to gitignore; regenerate after tree changes              |
| Rollup    | None — every card shows its own status (v0 rule)                                                            |

The generated file is a **build artifact, not a store**: nothing reads it back, and deleting it loses nothing.

## Consequences

- Epic #19 v0 acceptance is met: statuses/types render from `tasks/`, and git files remain the only source of truth.
- No framework, bundler, dev server, or new package — the "new top-level package" ADR trigger stays deferred until a v1 interactive viewer is actually needed.
- The board is a snapshot: it does not watch files. Re-run `arggon board` to refresh.
- Any future interactive viewer (thin edits, live reload) supersedes this ADR with a new package ADR; it must keep reusing the CLI/contract read path and prefer CLI writes.

## Alternatives considered

- **Standalone `viewer/` package with a framework + dev server** (React/Vite or similar): better for interactivity, but a new top-level package, a framework choice, and a live server are all unjustified for read-only v0.
- **Terminal (TUI) board**: no extra artifact, but hard to share, screenshot, or style; HTML is the lowest common denominator.
- **Hosted service reading the repo**: violates the spike's "no SaaS board that drifts from the repo" constraint.
