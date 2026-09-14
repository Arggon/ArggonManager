---
type: task
status: done
id: task-review-comments-instruction
title: "init instruction: review feedback lands in ArggonManager comments, not GitHub PR comments"
assignee: Arggon
branch: feat/task-review-comments-instruction
parent: story-init-docs
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-review-comments-instruction.md
  Leaves live only under a story. id is the filename stem: task-review-comments-instruction.
  CLI `arggon create task review-comments-instruction` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init instruction: review feedback lands in ArggonManager comments, not GitHub PR comments

## Context

Coordinator decision (2026-09-14): review feedback (verdicts, change requests)
must live in **ArggonManager's own comments** (`arggon comment <item-id>`),
which auto-commit to the tracker and are the agent handoff channel — NOT in
GitHub PR comments. GitHub is for PRs only (CI/merge mechanics); a review that
lives only on the PR is untracked by the tool the repo exists to prove out.
Observed in practice: the lead-architect reviews of the 2026-09-14 waves were
posted as PR comments; from now on they go through the tracker.

Init must deliver this instruction to adopters by default, so every agent
running under a generated AGENTS.md follows it without being told.

## Acceptance

- [x] templates/docs/AGENTS.md orchestration/review guidance states the channel: review verdicts and change requests are recorded with `arggon comment <item-id>` on the item; PR comments are not the review channel
- [x] docs/agents.md lead-architect review duty names `arggon comment` as the feedback channel (amend the existing bullet)
- [x] skills/arggon-cli/SKILL.md syncs (one line in the handoff/comments guidance); .agents copy regenerated via `npm run skills:sync` (parity test covers it)
- [x] init-docs test asserts the generated AGENTS.md carries the review-channel instruction

## Notes

### 2026-09-14 @Arggon
Implementation landed (commit f7a1d91): review channel institutionalized in templates/docs/AGENTS.md, docs/agents.md lead-architect bullet, skills/arggon-cli/SKILL.md (+skills:sync), and init-docs test assertion. Generated AGENTS.md at 2018 B (<=2048 budget). Full suite 817/817, lint, build green. Acceptance ticks applied; PR to follow.

Lead-architect review: APPROVED. The channel is institutionalized at all three layers (generated AGENTS.md orchestration guidance, docs/agents.md lead-architect bullet, SKILL handoff line + skills:sync) with the init-docs assertion locking it in. Budget held: 2018/2048 B — headroom is now ~30 B, so the NEXT init-docs addition will need prose compression or an ADR-level budget decision; flagged for the next cycle. Merge follows.
