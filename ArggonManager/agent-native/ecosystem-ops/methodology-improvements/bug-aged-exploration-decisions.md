---
type: bug
status: in_progress
id: bug-aged-exploration-decisions
title: Aged explorations 012/013 record no Decision section link
assignee: Arggon
branch: fix/bug-aged-exploration-decisions
parent: methodology-improvements
labels: [spec-analyze]
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T22:27:50.993Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-aged-exploration-decisions
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-aged-exploration-decisions.md
  Leaves live only under a story. id is the filename stem: bug-aged-exploration-decisions.
  CLI `arggon create bug aged-exploration-decisions` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Aged explorations 012/013 record no Decision section link

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [x] Each exploration links its ADR or records "No ADR required — <reason>" per agents.md §Specs and plans
- [x] `spec analyze` vs baseline shows 0 new findings

## Notes

### 2026-10-02 @Arggon
Docs-only PR (branch `fix/bug-aged-exploration-decisions`): both Decision sections now say what actually happened, verified against the tracker, git history and the ADR set. No scanner change, no finding text touched.

**Before** — `npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json`:

```
new warn ArggonManager/docs/explorations/exploration-open-source-agent-tooling-013.md:771: Decision section records no decision after 8 day(s) (threshold 7) … [DECISION-PENDING-EXPLORATION]
new warn ArggonManager/docs/explorations/exploration-ui-improvements-012.md:165: Decision section records no decision after 10 day(s) (threshold 7) … [DECISION-PENDING-EXPLORATION]
resolved warn …exploration-ui-improvements-012.md:165: … after 9 day(s) …
arggon spec analyze vs baseline …: 2 new, 1 resolved, 5 unchanged, 7 total
exit 1
```

**After** — same command, same baseline file:

```
resolved warn ArggonManager/docs/explorations/exploration-ui-improvements-012.md:165: Decision section records no decision after 9 day(s) (threshold 7) … [DECISION-PENDING-EXPLORATION]
arggon spec analyze vs baseline …: 0 new, 1 resolved, 5 unchanged, 5 total
exit 0
```

The remaining `resolved` line is the baseline's own snapshot entry — report-only, never an exit-code input, and the snapshot is deliberately left untouched (see baseline note below).

### What each exploration actually decided

**`exploration-ui-improvements-012`** (in-place v2 on the web board, TUI and native panel). Verified: all **21** items in its own filed-work table are `done`, epic `ui` reports `39 done / 0 todo / 0 in_progress`, and the lane added no runtime dependency (root `dependencies` = `@arggondev/lib`, `commander`; `lib` declares none; UI work is devDependency-only). The pre-existing text said "No ADR is required…" — which is a true decision the scanner cannot read, because it is not the marker form. It is now recorded as `No ADR required — <reason>` and the governing decisions are linked instead of paraphrased: ADR 0001 (dependency-light shape), ADR 0002 (v0 board; candidate 2 stays deferred by that same decision, so it is the superseding-ADR trigger), and ADR 0008 — whose decided-but-unbuilt tier 2 `task-ui-browser-smoke-ci` implemented, so the wave needed no new decision. `status: open` → `decided`, matching the `task-exploration-decision-records` precedent.

**`exploration-open-source-agent-tooling-013`** (open-source agent tooling). Its own gate was conditional on a pilot passing; pilot 2 **failed** (2026-09-28, PR #423), so the dev-only tooling ADR/playbook it proposed was never owed and is explicitly recorded as not filed. Each of the seven recommendations now records its outcome and where it is recorded, so no claim rests on the old "still at pilot proposed" text:

1. §0 worktree-readiness parity — **adopted** (`bug-native-start-worktree-no-install` done; contract in `agents.md` §Native `start` dependency contract; `smoke:native-start-cold` in CI).
2. §D/§E/§G CLI/test lane — **adopted, dev-only** (`@ast-grep/cli`, `fast-check`, `@axe-core/playwright`, `@playwright/test`; `sgconfig.yml` + `tools/ast-grep/rules/*.yml`; three items all done).
3. §C `codebase-memory-mcp` — **not adopted in this repository** (see gap note).
4. §A `opencode2-shell-tasks` — **not adopted**, measured FAIL.
5. §B `opencode-chromium@1.7.2` — **not adopted, hold stands** (absent from `package.json`; no fixed release).
6. §D `@playwright/mcp` — **not adopted**; that fallback lane is already decided by ADR 0008.
7. no second tracker/framework/planner/memory — **honored** (dependency sets unchanged).

The two cross-cutting questions it raised were decided later in their own records and are linked rather than re-decided here: §0's "optional providers after parity" by ADR 0019 (from exploration 017), and the browser lane by ADR 0008. The gate that would still demand an ADR (first real adoption of a browser plugin; any background-job surface this repo builds itself) is kept explicit.

### Gap the coordinator should know about (no ADR owed, but worth a call)

Recommendation 3 of exploration 013 — make `codebase-memory-mcp` the default code-discovery aid — is the one recommendation whose outcome the repository records **nowhere**: `grep -rl codebase-memory` over the tracked tree hits only this exploration and the negative-result item's body ("`codebase-memory-mcp` … untouched"). No ADR, no playbook, no item, and `AGENTS.md` does not mention it, so it is recorded here as *not adopted in this repository* rather than as an adopted standard. Nothing cross-cutting was chosen, so an ADR is not owed; if the project does want that tool standardized for agents, that is a new decision with its own item — filed deliberately **not** here, since this bug's scope is the two Decision sections.

The same reasoning covers recommendation 1: it was adopted, and no ADR was written, but it closed a gap **inside** the existing native-surface contract (ADR 0010 / ADR 0011) rather than choosing something new, so the ADR trigger in `agents.md` ("stack, identity, schema model, new top-level package") does not fire. Its record is the bug fix + `agents.md` + the deterministic cold-start smoke. Flagging it explicitly so the reviewer can disagree with that reading.

### Gates (this worktree, Node 22)

| Gate | Expected | Observed |
| --- | --- | --- |
| `npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json` | 0 new findings, exit 0 | `0 new, 1 resolved, 5 unchanged, 5 total`, exit 0 |
| `npm run arggon -- validate` | ok | `arggon validate: ok (0 warning(s), convention v5)`, exit 0 |
| `npx vitest run cli/src/prose-format.test.ts cli/src/spec-decision-gaps.test.ts` | green (prose survives prettier; scanner grammar intact) | 2 files / 27 tests passed |
| `npm run lint` | clean | exit 0, no output |
| `npm run arggon -- doctor` | clean | exit 0 (pre-existing worktree-vs-primary generated-copy deltas only) |
| pre-commit hook (`arggon validate`) | runs, never bypassed | green on the commit; `--no-verify` never used |

Scanner untouched: `git diff` on the branch touches only the two exploration docs and this item's file (`cli/src/spec.ts` unmodified), and `cli/src/spec-decision-gaps.test.ts` (6 marker cases) still passes.

### Baseline: deliberately not updated

`ArggonManager/spec-analyze-baseline.json` is left as committed. `agents.md` §Specs and plans documents the baseline only as the NEW-findings wave gate ("non-zero exit = NEW findings vs the committed snapshot"), and there is no documented refresh-on-resolution workflow; both baselines in the tree were committed once and never refreshed (`50de2786`, `74749bbf`). Refreshing it would delete the evidence that these two findings existed and were closed — the `resolved` line is report-only and does not affect the exit code, so the acceptance criterion is met without it.

### Tracker-write hazard check

Every write was made from this worktree (`/home/arggon/Projects/ArggonManager-bug-aged-exploration-decisions`). The native `tools.arggon.*` surface resolves the tracker root from the session cwd, which is the **primary** checkout here, so it was used read-only; all mutations (this comment, the handoff) go through `npm run arggon -- …` executed with the worktree as cwd. The primary checkout is still at `17091702` with a clean `git status` — no commit landed there.

### handoff 2026-10-02 @Arggon — next: Coordinator: review + merge the PR for fix/bug-aged-exploration-decisions (merge, do not squash — it carries tracker auto-commits), then flip this bug to done.
- branch: fix/bug-aged-exploration-decisions
- open questions: Is exploration-013 rec 3 (codebase-memory-mcp) meant to be a repo standard? Recorded as not adopted in-repo; filing is your call. Confirm baseline stays unrefreshed.
