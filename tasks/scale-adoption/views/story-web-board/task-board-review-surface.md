---
type: task
status: done
id: task-board-review-surface
title: "board review surface: per-item PR status, checks and diff link"
assignee: Arggon
branch: feat/task-board-review-surface
parent: story-web-board
labels: [p3]
created: "2026-09-15"
updated: "2026-09-15"
depends_on: [task-board-dependency-visuals]
---
<!--
  Placement (v0): tasks/scale-adoption/views/story-web-board/task-board-review-surface.md
  Leaves live only under a story. id is the filename stem: task-board-review-surface.
  CLI `arggon create task board-review-surface` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# board review surface: per-item PR status, checks and diff link

## Context

Candidate #6 of [product discovery](docs/explorations/exploration-product-discovery-002.md): board cards show a PR badge only with `--github`; orchestration tools compete on diff-first review (Vibe Kanban, Conductor — vibekanban.com, madelove.com, 2026-09-15). A standing `--serve` board with per-item PR state, checks and diff links makes the board the review cockpit — reusing the existing gh read path. Effort M; principle: cheap-infra.

## Acceptance

- [x] --serve board renders per-item PR state (open/draft/merged + checks) and a diff link for items with a branch/PR
- [x] Reuses the existing gh read path (get-open-prs); no new dependencies; rate-limit-safe (cached/poll)
- [x] Tests for the render path; docs updated

## Notes

- Scope guard decision: the review surface (live PR strip + diff links) lands on the `--serve` HTML board ONLY. The static export (`arggon board`, incl. `--github`) and `--tui` are untouched: the static file stays byte-identical (no `diffLinks` in its render options), and `--tui` is deliberately out of scope. Rationale: the standing serve board is where review happens (fresh renders, SSE reload, update endpoint); the static export remains a portable offline snapshot.
- Implementation: board-serve.ts now polls the existing gh read path (defaultBoardGithub → ghPrListJson in get-open-prs.ts — no changes to that file) on a 60s interval against a cached snapshot; a changed snapshot broadcasts an SSE reload. gh missing/unauthenticated or a failed poll degrades cleanly: last good snapshot (or none) keeps rendering, cards show the neutral `○ no PR` badge, server never fails. renderBoardHtml gains a serve-only `diffLinks` option appending a `/files` diff link next to the PR badge.
- No board envelope fields added, so docs/json-output.md is unchanged.

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. Extended the existing gh read path injectably instead of forking, poll off the accept path (unref'd) so a slow gh never delays the server, last-good-snapshot degradation keeps the cockpit alive, and the serve-only scope guard (static export byte-identical, --tui untouched) is exactly the restraint the cheap-infra principle asks for. Merge follows.
