# Orchestration — multi-agent work

Part of the `arggon-cli` skill (`SKILL.md`). Non-trivial items are **orchestrated
by default**: a coordinator delegates them to subagents instead of working them
inline. Trivial items (one-line fixes, doc tweaks) stay inline. Full rules:
`ArggonManager/docs/agents.md` §Orchestration.

## Coordinator duties

- **Wave planning by file-disjointness:** group claimable items into waves whose
  members touch disjoint files/modules; items that would collide go in different
  waves.
- **Per-item worktrees:** one subagent per item, each in its own worktree
  (`../<repo>-<item-id>`); no two subagents share a working tree.
- **Code review (lead architect):** review **every** subagent PR before merge
  against the review bar in `ArggonManager/docs/engineering.md` (architecture-first,
  conventions first, quality/security bar, tests travel with behavior, docs
  travel with code, scope stays on the item, **blocking smoke test**) plus the
  coordination specifics: surgical staging, no cross-item files, no unrelated
  reformatting, acceptance ticks honest. Change requests and verdicts go back via
  `arggon comment <item-id>` on the item — never as GitHub PR comments.
- **Merge verification:** after each subagent PR, verify the merge; resolve
  cross-item conflicts when waves overlap.
- **Tracker ownership:** claim conflicts, blocked items, follow-up filing, and
  final wave verification (`arggon validate` ok, `arggon doctor` clean).

## Subagent rules

- Claim **your** item (`in_progress` + assignee) and stay inside **your** worktree.
- Never flip your item `done` — completion is the coordinator's call after merge
  verification — and never reopen `done`/`cancelled` or steal a claim.
- Expect the coordinator's review and address change requests before merge.
- Come with smoke evidence for behavior changes: changed commands probed on a
  fixture (expected vs observed); UI changes browser-driven per ADR 0008 — the
  smoke gate blocks merge.
- Report findings back to the coordinator instead of filing tracker items — the
  coordinator consolidates and files.

## Worktrees in practice

`arggon start <id> --worktree` claims, creates (or attaches to) the worktree at
`../<repo-name>-<id>`, runs the claim commit/push inside it, and records
`worktree_path` on the item. Start prepares the worktree first — it links the
primary checkout's `node_modules` when the worktree lacks one, so the repo's
pre-commit gate can run (the link is untracked and start never commits it; it is
removed before a configured `x-worktree.post-start` hook runs, so `npm ci`
cannot reify through it and empty the primary install) — and a failure after
creation keeps the worktree and branch instead of deleting them (the error names
the failing step, path and remediation; re-running attaches). The linked install
is the primary's, so workspace packages the worktree also carries
(`node_modules/@arggon/lib -> ../../lib`) resolve into the primary copy: the
spawned CLI/tests then run the primary's build. `start --worktree` names them as
`linkedWorkspaces` in `--json` (re-read after the hook); a worktree that must use
its own copy needs a real local install (`npm ci`, e.g. via
`x-worktree.post-start: npm ci`). Move the session into that path
(`session_move` in OpenCode V2) so every later command runs there. When the work
is merged, `arggon cleanup` lists stale worktrees and `--prune` removes them.

The claim, branch, PR and validate rules apply to subagents **unchanged**: same
commands, same gates, same never-list. The kernel enforces the rules; neither
role forks them.
