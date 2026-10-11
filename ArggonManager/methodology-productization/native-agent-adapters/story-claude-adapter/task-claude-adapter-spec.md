---
type: task
status: in_progress
id: task-claude-adapter-spec
title: "Claude Code adapter: spec + story filing (plan T6)"
assignee: arggon-delivery-lead
branch: feat/task-claude-adapter-spec
parent: story-claude-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-11"
claimed_at: "2026-10-11T09:58:50.239Z"
depends_on: [task-opencode-prompt-stamp, task-opencode-event-panel, task-zcode-goal-mode, task-zcode-automations]
worktree_path: /home/arggon/Projects/ArggonManager-task-claude-adapter-spec
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-claude-adapter/task-claude-adapter-spec.md
  Leaves live only under a story. id is the filename stem: task-claude-adapter-spec.
  CLI `arggon create task claude-adapter-spec` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Claude Code adapter: spec + story filing (plan T6)

## Context

File the Claude Code adapter story with acceptance: plugin bundle (skills/agents/hooks/commands/MCP), marketplace manifest, headless smoke bar; no code in this wave

## Acceptance

Expanded from the plan's T6 one-liner ("story filed with checklist, linked from the spec; no code in this wave") into the checkable contract, per `ArggonManager/docs/agents.md` §5. The story body itself is the delivery lead's tracker write (drafted in the comment below), so its box is the one open item.

- [x] A spec exists at the next **free** number under `ArggonManager/docs/specs/` — `spec-claude-code-adapter-024.md`, scaffolded by `arggon spec new` (024 was free, not "last plus one"; `spec new` never overwrites) — implementing §S6 with Purpose, Synopsis, Invariants, Acceptance criteria, a failure-path table and named open questions
- [x] The spec carries the shipped role vocabulary (`arggon-maker` / `arggon-standards-reviewer`, never §S6's pre-rename `coordinator/worker/reviewer`), states which roles a Claude Code tree can express, and puts the delivery lead's contract on the generated `CLAUDE.md` → `@AGENTS.md` carriers — never a plugin-root `CLAUDE.md`, which Claude Code does not load as context
- [x] The spec names the honest starting floor in writing — the generated `CLAUDE.md` → `@AGENTS.md` pointer and the generated `.mcp.json` → `arggon mcp` registration — plus the three non-gap and two gap rows the floor carries today and the row deltas the bundle is expected to produce, and nothing more
- [x] The spec carries the layout decision explicitly: the bundle is `templates/docs/claude/**` → `.claude-marketplace/**`, mirroring the shipped ZCode seam; §S6's stale `adapters/claude/` is not propagated, and `adapters/` stays the capability matrix (read, not edited)
- [x] No implementation in this wave: the diff is docs + tracker only — one new spec file and one link-only edit inside §S6. No bundle, no adapter seam file, no `init` / `doctor` / `lib` / `cli` change, no capability-matrix edit
- [x] `arggon spec validate` and `arggon spec analyze` are clean with no NEW finding naming this item: baseline 4 findings across 23 specs → 4 findings across 24 specs, the same four, none naming this item, the new spec or `story-claude-adapter`
- [x] `arggon validate` is green and `npx prettier --check` is clean on both touched files
- [x] Impact class stated: this wave is docs-only and touches no methodology carrier, so no class applies; the implementation wave is **Behavioral** under `ArggonManager/docs/agents.md` §Changing the methodology itself (it edits `agents.md` and the bundled skill)
- [x] The ADR 0017 decision is stated, not assumed: a Claude bundle is a **bounded port of the shipped ZCode shape**, so no exploration artifact is owed — with the one-way ratchet named so a contradicting client shape stops the wave and files the exploration
- [ ] `story-claude-adapter` carries the full acceptance checklist with a link to `spec-claude-code-adapter-024` so both directions resolve — the delivery lead's write (the story file has been a placeholder shell since 2026-10-02); the complete draft is in the comment on this item, and the spec → story direction already resolves

## Notes
