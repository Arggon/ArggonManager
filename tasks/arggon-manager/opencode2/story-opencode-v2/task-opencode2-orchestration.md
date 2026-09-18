---
type: task
status: done
id: task-opencode2-orchestration
title: "Orchestration on OpenCode V2: coordinator, workers, waves"
assignee: Arggon
branch: feat/task-opencode2-orchestration
parent: story-opencode-v2
labels: []
priority: p1
created: "2026-09-18"
updated: "2026-09-18"
depends_on: [task-opencode-v2-spec, task-opencode-v2-plugin]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-orchestration
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode2-orchestration.md
  Leaves live only under a story. id is the filename stem: task-opencode2-orchestration.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Orchestration on OpenCode V2: coordinator, workers, waves

## Context

W4 of [plan-opencode2-009](../../../../docs/plans/plan-opencode2-009.md):
the orchestration model in [docs/agents.md](../../../../docs/agents.md)
(coordinator delegates, one subagent per item per worktree, lead-architect
review of every PR, merge verification, tracker ownership) becomes native V2
agents, commands and flows — same rules, better runtime primitives
(background subagents, context isolation, permissions, Code Mode batching).

## Acceptance

- [x] Generated agents: `arggon-coordinator` (primary; wave planning, review,
      merge verification, tracker ownership), `arggon-worker` (subagent; one
      item, own worktree, reports findings instead of filing), `arggon-reviewer`
      (subagent; edits denied through permissions, reads/tests allowed, encodes
      the review bar + smoke gate from engineering.md).
- [x] Commands: `/arggon-review` (reviewer verdict with smoke evidence, verdict
      posted via `arggon comment`) and `/arggon-done` (verify checklist + gates,
      then `update --status done`); `agent`/`subagent` frontmatter correct.
- [x] Subagent permission probes: a worker is denied `subagent` launches
      (no nesting beyond one); the reviewer is denied `edit`; the coordinator
      can launch only the worker/reviewer ids (allow-list), verified with
      evidence.
- [x] End-to-end scripted wave on a fixture with a local bare remote: two
      file-disjoint items, two background workers with separate worktrees,
      reviewer verdict, coordinator merge verification; transcript as evidence.
- [x] Context accounting for the run recorded (feeds task-opencode2-context):
      per-worker prompt/tool token estimate before and after the item block.
- [x] Docs: orchestration section of `docs/agents.md` updated to describe the
      V2 flow as the reference implementation (rules unchanged).

## Notes

- Depends on task-opencode-v2-spec (agent generation contract) and
  task-opencode-v2-plugin (context injection makes worker sessions anchored).
- Without the plugin this task degrades to agents + commands only; the
  end-to-end evidence requires the plugin wave merged.

### 2026-09-18 @Arggon
### W4 evidence — orchestration on OpenCode V2 (T12–T13)

Branch `feat/task-opencode2-orchestration`. All gates green: full suite 69 files / **1103 tests passed**, `npm run smoke:opencode`, `npm run smoke:opencode:wave` (new), `npm run lint`, `npm run build`, `arggon validate`, `arggon spec validate`.

**Permission probes (real opencode v2.0.7, headless; transcripts in the PR)**
- `arggon-reviewer` edit → **denied**: the session catalog has no `edit`/`write`/`patch` (tool list: browser, execute, glob, grep, opencode, question, read, shell, skill, webfetch, websearch); the probe file is never created.
- `arggon-worker` subagent → **denied**: no `subagent` tool (`NO_SUBAGENT_TOOL`), no child session id.
- `arggon-coordinator` → `explore` / `arggon-worker` / `arggon-reviewer` launches completed; `general` → tool error `Permission denied: subagent`.
- **Probe-driven template fix**: the reviewer could nest (coordinator → reviewer → explore), contradicting one-level nesting; `arggon-reviewer` now also denies `subagent`. Seam test asserts worker/reviewer no-nesting + reviewer edit deny.

**Scripted wave** (`npm run smoke:opencode:wave`; fixture repo + **local bare remote**, no GitHub)
- **plan**: coordinator named both file-disjoint items and their files.
- **delegate**: two `arggon-worker` subagents launched **foreground in one assistant step** (batched); each ran `arggon start <id> --worktree --assignee …`; two disjoint worktrees, each without the sibling file; `wave-alpha.txt` = `alpha`, `wave-beta.txt` = `beta`; branches pushed to origin; claim + comment + handoff present on each branch.
- **review**: `arggon-reviewer` posted verdicts on both items via `arggon comment` (e.g. alpha: “review verdict: merge — … byte-exact 'alpha' (5 bytes, no trailing newline) … scope stays on item … `arggon validate` green … could not verify: CI (local bare origin)”).
- **merge/done**: both branches merged into main (fast-forward + merge commit), acceptance boxes ticked, both items `done`, `arggon validate` green, main pushed to origin.
- Harness note: workflows must run **foreground** — a background subagent notifies the parent later, but `opencode run` exits when the turn ends, so background children would outlive the headless run. Fixtures live under OpenCode's managed temp dir and runs pass `--auto` (headless has no client to answer `ask` prompts; configured `deny` rules stay enforced).

**Context accounting (feeds task-opencode2-context)**
- Method: same agent (arggon-worker) + same prompt, with/without `ARGON_ITEM`; token numbers from `opencode session export`; worker child sessions exported by session id.
- Item block: **324 B** ≤ 1024 B in the accounting fixture; **180 B** (alpha) / **178 B** (beta) per injection in the wave.
- Controlled A/B: with block 1 call → 8396 fresh input / 0 cache-read / 102 output; without block 1 call → 8299 fresh / 0 / 219; **+324 B/call (~81 tok @4 B/tok heuristic), observed +97 fresh input tokens**.
- Real worker child sessions: A 13 calls → 34168 fresh input + 172288 cache-read / 2655 output (10 injections); B 10 calls → 26558 + 129280 / 2304 (8 injections).
- Coordinator batching: **2 `subagent` calls in 1 assistant step** (the two worker launches) — one prompt/context re-send saved.

**What could not be asserted**
- No GitHub in the fixture: the “PR” is the local branch and the merge is local; no CI check.
- Coordinator autonomy is bounded to four sequential prompts in one session (single-prompt full autonomy is flaky headless on a cheap model); the harness hard-fails when a phase's observable outcome is missing (never fakes).
- The reviewer keeps `shell` (it must run the gates): the `edit` action is denied, shell-based mutation is a documented, deliberate trade-off.

### handoff 2026-09-18 @Arggon — next: Review PR #330 (draft) and its evidence comment; then merge and flip done — no further code work expected.
- branch: feat/task-opencode2-orchestration
- open questions: None blocking; reviewer keeps shell by design (edit denied only).

### 2026-09-18 @Arggon
PR: https://github.com/Arggon/ArggonManager/pull/330 (draft, base `opencode2`).

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; the reviewer re-ran smoke:opencode:wave (2 fixtures/0 failures) and cross-checked the retained session exports byte-for-byte (two subagent launches in 1 step, distinct worktrees, verdicts on items, local merges + done, validate green; A/B +96 fresh input tokens for a 324 B item block); reviewer deny-subagent template fix verified. Findings 1-4 filed as task-opencode2-orchestration-hardening. Closing.
