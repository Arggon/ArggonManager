---
type: task
status: done
id: task-prover-agent-reviewer-split
title: "Split execution evidence out of the reviewer: a shell-capable arggon-prover agent + a read-and-reason reviewer contract"
assignee: Arggon
branch: feat/task-prover-agent-reviewer-split
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam, methodology]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-prover-agent-reviewer-split.md
  Leaves live only under a story. id is the filename stem: task-prover-agent-reviewer-split.
  CLI `arggon create task prover-agent-reviewer-split` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Split execution evidence out of the reviewer: a shell-capable arggon-prover agent + a read-and-reason reviewer contract

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Triggered by the #579 review round: the reviewer tried to RUN bash commands (suites/probes) and hit walls, and the user called the role split out explicitly. Diagnosis first, because the fix is NOT a permissions change: a live probe through `arggon-reviewer` (`echo`, `git status`, `npm run arggon -- validate`) shows all three SUCCEED today — the blanket `Permission denied: shell` of the earlier session was the malformed `opencode.jsonc` failing closed (bug-opencode-jsonc-malformed-permissions, merged), and the `explore` probe was separately blanket-denied by its own agent policy, which is a different mechanism. The real defect is the ROLE: one agent doing both judging and executing.

The split, as implemented on `feat/task-prover-agent-reviewer-split` (worktree `../ArggonManager-task-prover-agent-reviewer-split`):
1. NEW `arggon-prover` (`.opencode/agents/arggon-prover.md`, from `templates/docs/opencode/agents/`): shell ALLOWED for the gates a verdict needs, but `edit`/`subagent`/every mutating `arggon` tool and `git commit|push|merge|rebase` denied. Output contract is `command / expected / observed / exit / does NOT prove` — verbatim output, failures never summarized as passes, skips reported as skips, every result bounded by what it does not prove.
2. `arggon-reviewer` is now **read-and-reason**: no suites, no builds, no smokes. When execution evidence is genuinely needed it emits `## Probes needed` (exact command + cwd + what it demonstrates + what the result would change) and the coordinator routes it to the prover. Its permission posture is unchanged (still cannot edit); only its instructions changed.
3. The ZCode seam is structurally already execution-free (the reviewer's `tools:` allowlist has no shell), so it gets the same contract wording and NO prover for v1 — the coordinator or worker runs probes there. Recorded as the item's open question, answered.
4. `agents.md` documents who-proves/who-reviews with the methodology impact class (Behavioral per ADR 0016 — an agent's operating contract changes), and the init seam test pins the prover file plus both contract invariants.

## Acceptance
- [x] `templates/docs/opencode/agents/arggon-prover.md` exists with the permission posture above (shell allowed; edit/subagent/arggon writes/git history writes denied) and an explicit output contract (command, expected vs observed, exit code, what it does NOT prove).
- [x] `arggon-reviewer` no longer instructs itself to run tests, and defines the `## Probes needed` hand-off instead; its permission posture is unchanged (still read-only tree).
- [x] This repo's `.opencode/agents/` regenerated from the templates (reviewer updated, prover created) — `arggon init` produces them from a clean scratch dir too (init test pinned: 42/42 green including the new contract test).
- [x] `ArggonManager/docs/agents.md` documents the split (who proves, who reviews) with the methodology impact class stated (Behavioral per ADR 0016).
- [x] Gates: npm test, lint, build, check:plugin, validate ok; CI green on the PR. Evidence: 2143 green / 117 files (incl. 42 init-opencode, 49 doctor, 38 init), lint clean, build clean, check:plugin exit 0, validate ok (0 warnings, convention v5), CI green on the reconciled head; merged as PR #583 squash.
