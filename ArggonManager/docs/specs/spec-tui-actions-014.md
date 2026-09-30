---
spec_id: tui-actions-014
title: TUI actions (claim/status) through the kernel update path
status: implemented
created: 2026-09-30
---

# Spec: TUI actions (claim/status) through the kernel update path (tui-actions-014)

## Purpose

The terminal kanban (`arggon board --tui`) is read-only by its v1 story
acceptance (story-tui-board): it renders the tracker, writes nothing. The
served board has since proved the safe write pattern for a board surface
(task-board-dnd-rules, board-serve): client-side rules kept 1:1 with the
kernel (`status.ts` TRANSITIONS + the claim and blocked-reason rules of
`update.ts`), an embedded parity test pinning the mirror to the kernel, and
every write routed through the kernel `runUpdate` — never force, never steal.
Extending the terminal board with actions without that treatment would fork a
second legality implementation onto a second interactive surface.

This spec adds two write actions to `board --tui` under exactly that pattern:

- `c` — claim the selected item (assignee prompt), and
- `m` — move the selected item through a LEGAL transition (menu, prompts,
  confirmation).

Invariants, in shorthand: **one kernel write path** (`runUpdate`), **force and
steal structurally impossible** (no flag exists to reach them from the TUI),
**legality pinned three ways** (TUI mirror ≡ board `evaluateDrop` ≡ kernel
transition table), **failures are footer text, never crashes**, and **the
alternate screen is never left dirty**.

Out of scope: any other field edit (title, labels, priority, dependencies —
still CLI/MCP-only), tracker auto-commit of TUI writes (parity with the served
board: writes land as working-tree changes; committing stays the caller's
job), and any batch/undo facility.

## Synopsis

```bash
arggon board --tui
#   c  claim the selected item: assignee prompt (default = resolved login),
#      then runUpdate({ id, status: "in_progress", assignee })
#   m  move the selected item: menu of LEGAL targets only -> optional
#      reason/assignee prompt -> y/N confirmation -> runUpdate({ id, status,
#      assignee?, blockedReason? })
```

No new CLI flags, no JSON changes: `board --tui` keeps failing on non-TTY
stdout and stays non-combinable with `--json`/`--serve`. The write surface is
the kernel function the CLI's own `update` command and the board's
`/api/update` endpoint already use (`runUpdate`, `lib/src/update.ts`) — the
TUI adds no second mutation path.

## Design

### Keys and modes

- `c` (board mode, item selected): claim flow. Only claimable types (story,
  task, bug — the kernel `isClaimable` rule); anything else refuses in the
  footer ("not claimable"). Only an unclaimed item can be claimed; a claimed
  item refuses with the claim-conflict wording (never steal — see below).
  The prompt asks for the assignee (prefilled with the resolved login —
  `GITHUB_USER`/`GITHUB_ACTOR`/`gh api user`, the memoized resolver the
  filter lens uses; empty input keeps the prefill); Enter applies through
  `runUpdate({ cwd, id, status: "in_progress", assignee })`. The prompt IS
  the confirmation for a claim. The kernel transition table still governs: a
  claim from a status that cannot reach `in_progress` (e.g. `done`) is
  refused by the same legality rule as `m` before any prompt opens.
- `m` (board mode, item selected): move flow, four stages, `esc` backs out of
  each:
  1. **menu** — lists ONLY the legal targets for the item's current status
     (kernel `TRANSITIONS` via the TUI verdict below), numbered `1..n`;
     number keys select. An item with no legal target shows the refusal
     instead of an empty menu.
  2. **reason** — required non-empty `blocked_reason` when the target is
     `blocked`; empty input is refused inline and stays at the prompt.
  3. **assignee** — when the target is `in_progress` on an unclaimed
     claimable item (the kernel claim rule), the same assignee prompt as `c`.
  4. **confirm** — one `y/N` line naming the exact change
     (`apply task-x: todo -> in_progress (assignee mia)?`); `y` applies,
     anything else cancels with nothing written.
- `esc`, `q`, `Ctrl-C` keep their existing semantics; the action flow never
  traps them (`Ctrl-C` quits from inside a prompt, `esc` cancels the flow).
- The board's other keys (arrows, `s`, `l`, `v`, `/`, `r`) are inert while an
  action flow is open: the flow is modal, the board state behind it is
  untouched, and cancelling returns to exactly the previous frame.

### Legality: the embedded mirror, pinned three ways

`cli/src/tui.ts` embeds its own pure verdict — `tuiActionVerdict(item, to,
edit)` and `tuiLegalMoves(item)` — mirroring `cli/src/board.ts`'s
`evaluateDrop` (transitions table, same-status refusal, claim-conflict
refusal, `in_progress` requires assignee) plus the TUI-only blocked-reason
requirement. It is a deliberate mirror, not an import: the served board needs
a self-contained browser function, the TUI needs a pure reducer rule, and the
parity test is what makes the three honest:

- for every (status, target) pair and every claim shape (claimable /
  container; unclaimed / claimed-by-other / claimed-by-same):
  `tuiActionVerdict(...).ok` ≡ `evaluateDrop(card, to, { assignee,
force: false }).ok`, and both agree with the kernel `canTransition` table
  plus `runUpdate`'s observable accept/refuse on a real fixture for a
  representative sample of cases;
- `evaluateDrop`'s embedded transition table ≡ `lib/src/status.ts`
  `TRANSITIONS` (already pinned by board-parity.test.ts — extended here to
  the TUI rule);
- `force` is refused on sight in the mirror (like `evaluateDrop`), but the
  TUI never even constructs a force edit — there is no key, prompt or flag
  that could carry one.

### Why force and steal stay impossible

- The TUI calls `runUpdate` WITHOUT `force` and WITHOUT `steal`: the call
  sites are the two flows above, and neither has a parameter that could carry
  them. There is no `--force` equivalent anywhere in the TUI keymap.
- The claim-conflict rule (a claimed claimable item cannot be reassigned)
  is mirrored in `tuiActionVerdict`, so `c` on a claimed item refuses before
  a prompt even opens, and `m` to `in_progress` on a claimed item refuses at
  the verdict — the same refusal the kernel would raise, surfaced early.
- The kernel stays the second gate: even a future TUI bug that posted an
  illegal edit would be refused by `runUpdate` (illegal transition, claim
  rule, unknown id) and surface as footer text.

### Error surfacing and screen hygiene

- Every `runUpdate` failure (unknown id, illegal transition after a stale
  menu — the tree may have moved under an open flow — claim rule, lock
  timeout, disk error) closes the flow and renders the kernel's message in
  the footer, sanitized like every repo-controlled value. The board stays
  open and consistent: the loop re-reads the tree after every key batch, so
  the next frame reflects the disk truth.
- Success renders a transient footer message (`claimed task-x (in_progress)`,
  `task-x: todo -> done (cascade: story-y)`) and the re-read repaints the
  move.
- The alternate screen + hidden cursor are acquired once and released on the
  existing exit paths only (`q`, `Ctrl-C`, fatal error). A failed or cancelled
  action never touches the screen state; there is no code path that writes a
  frame outside the loop's `render()`.
- The kernel takes the per-item lock (`withItemLock`) inside `runUpdate`;
  a concurrent writer wins or loses atomically and the loser sees the
  kernel's error text.

### Writes are working-tree changes (serve parity)

Like the served board's drag-and-drop, a TUI write does NOT auto-commit: the
item file changes on disk, the debounced watcher repaints every open board,
and committing stays the caller's/agent's job (the CLI commands keep their own
auto-commit policy). Documented in README.

### Reopening done/cancelled

`done -> todo` and `cancelled -> todo` are kernel-legal transitions and stay
available through `m` — behind the same `y/N` confirmation every move gets
(the TUI is an interactive terminal, so the confirmation is the exact
equivalent of the CLI's interactive reopen gate). The agent-only restrictions
(no reopen, no steal, no waiver) are MCP/native rules and are not recreated
here; there is still no waive path in the TUI.

## Acceptance

- [x] Spec + plan under `ArggonManager/docs/specs/` + `ArggonManager/docs/plans/` written before implementation; both flipped to `implemented` in the same PR
- [x] `c` claims the selected item through the assignee prompt; `m` moves through a menu of kernel-legal targets with reason (blocked) / assignee (claim) prompts and a `y/N` confirmation; every write goes through `runUpdate` — the TUI constructs neither `force` nor `steal`
- [x] Parity test: `tuiActionVerdict` ≡ board `evaluateDrop` ≡ kernel `TRANSITIONS`/`runUpdate` over the full status × target × claim-shape matrix, plus live fixture cases
- [x] Failures surface as sanitized footer text; a failed/cancelled action never crashes the loop and never leaves the alternate screen dirty
- [x] Golden reducer/renderer tests + pty smoke evidence (claim and move applied through the real kernel on a fixture); README keybindings + `--tui` docs updated
