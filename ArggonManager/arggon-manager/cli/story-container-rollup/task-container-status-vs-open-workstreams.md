---
type: task
status: todo
id: task-container-status-vs-open-workstreams
title: "Decide: container `done` labels over unfinished workstreams — correct the stored statuses (owner reopen) or derive the board label"
parent: story-container-rollup
labels: []
created: "2026-10-14"
updated: "2026-10-14"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-container-rollup/task-container-status-vs-open-workstreams.md
  Leaves live only under a story. id is the filename stem: task-container-status-vs-open-workstreams.
  CLI `arggon create task container-status-vs-open-workstreams` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Decide: container `done` labels over unfinished workstreams — correct the stored statuses (owner reopen) or derive the board label

## Context

Product-owner report (2026-10-14, twice): the board shows `done` on containers that still hold
unfinished workstreams — the strongest case being a whole story in `todo` under a done epic.
Measured: five containers hold an open story (`agent-native`, `agent-coordination`,
`ecosystem-ops`, `ui`, `arggon-manager`); 15 of 84 containers are terminal with open
descendants overall. The stored statuses are stale closures (work was added after the
containers closed), and the tracker cannot self-correct: reopening a terminal item is one of
the four human-only powers (`ArggonManager/docs/engineering.md` §Roles and authority). The
`decide:` brief below carries the question, options, recommendation and default; this item is
its canonical home (ADR 0026).

## Acceptance

- [ ] The product owner's answer is recorded as a `decided:` comment on this item
- [ ] The chosen option is executed: option 1 → the five containers reopened by the owner (human-only) + a report-only "terminal container holding an open story" check filed/implemented; option 2 → the board's derived-label change merged; option 3 → both
- [ ] After execution, the tracker's tree has no terminal container holding an open story (full traversal verified; `arggon validate` green)

## Notes

### 2026-10-14 @ses_eccc605dbffeHEwy9fqO3FP5tx

decide: Container `done` labels over unfinished workstreams — correct the stored statuses, or derive the board label?

**The question.** Five containers are stored as `done` while a whole unfinished story sits inside them (`agent-native`, `agent-coordination`, `ecosystem-ops`, `ui`, `arggon-manager`; the open stories are `parallel-worktree-runtime-isolation-ports-state-services`, `story-ci-wall-clock`, `story-hierarchy-navigation`). Should the stored statuses be corrected — you reopen the five, a human-only power — or should the board show an effective state instead (which I can do alone)?

**Why it matters.** You read the board as the project's state, and a `done` label above unfinished work makes it misleading. The tracker cannot fix itself: a closed item stays closed until a human reopens it (by design — one of the four irreversible powers), and work can be filed under closed containers, so the mismatch piles up (15 of 84 containers today; 5 of them hold open stories, the rest only stray follow-ups).

**The options.**

1. **Correct the stored statuses (recommended).** You reopen the five containers with the commands below — ~2 minutes, each asks you to confirm `y` (that confirmation is the human-only gate; agents structurally cannot do it, me included). Then `done` is true everywhere (board, CLI, reports). I add a report-only check that flags "closed container holding an open story" so it cannot silently recur. Leaf follow-ups under closed stories are unaffected — they keep `done` + the `N open` count badge.
   - Cost: needs your terminal; one-time cleanup, and new workstreams filed under closed containers can recreate the state (the check catches it).
2. **Derive the board label (no action from you).** A container with an open story/epic inside stops displaying `done` on the board (it shows the effective state, e.g. `in progress`); the stored status stays as the closure record. The board reads truthfully forever, zero maintenance. If you want it stricter (any open bug/task also hides `done`), say so — one-line extension.
   - Cost: the board label no longer matches the stored status (today it shows exactly what is in the file), and the CLI/other surfaces would still show the stored `done` — two readings of one item; also a documented-rule change ("status is authored, never derived").
3. **Both.** Reopen the five (one truth in the files) and keep the board honest even if the data drifts again (derived label as a safety net).
   - Cost: does both; needs your terminal once.

**Recommendation.** Option 1: state lives in the files; the board should reflect what is true there; and reopening is exactly the product-owner power for correcting a closure that later work invalidated.

**Strongest argument against.** It needs your terminal and is not self-enforcing — new workstreams under closed containers recreate the mismatch; option 2 is the only zero-maintenance guarantee, and the new check only reports.

**Default.** If no answer by **2026-10-16**, I implement option 2 (the board derives the label) — the only path that needs nothing from you — and leave the stored statuses as they are.

**The five commands** (from the repo root; each asks `y`/`N` — answer `y`):

```bash
npm run arggon -- update agent-native --status in_progress
npm run arggon -- update agent-coordination --status in_progress
npm run arggon -- update ecosystem-ops --status in_progress
npm run arggon -- update ui --status in_progress
npm run arggon -- update arggon-manager --status in_progress
```

(If the tool prefers `--status todo`, that works identically — same confirmation.)

### 2026-10-14 @ses_eccc605dbffeHEwy9fqO3FP5tx
Correction to the brief's command block (delivery lead, 2026-10-14): the transition table allows `done → todo` only, so `--status in_progress` as the FIRST step is refused (`allowed: todo`). The owner ran the block; all five refused and nothing changed. The reopen is two passes:

**Pass 1 — the human-only, TTY-gated reopen (answer `y` at each prompt):**
```bash
npm run arggon -- update agent-native --status todo
npm run arggon -- update agent-coordination --status todo
npm run arggon -- update ecosystem-ops --status todo
npm run arggon -- update ui --status todo
npm run arggon -- update argson-manager --status todo
```

**Pass 2 — normal transition, no confirmation (containers may be `in_progress` without assignee):**
```bash
npm run arggon -- update agent-native --status in_progress
npm run arggon -- update agent-coordination --status in_progress
npm run arggon -- update ecosystem-ops --status in_progress
npm run arggon -- update ui --status in_progress
npm run arggon -- update argson-manager --status in_progress
```
