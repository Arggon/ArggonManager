---
type: bug
status: in_progress
id: bug-harness-config-churn
title: harness-config-churn-blocks-start
assignee: Arggon
branch: fix/bug-harness-config-churn
parent: methodology-improvements
labels: []
priority: p3
created: "2026-09-30"
updated: "2026-10-01"
claimed_at: "2026-10-01T02:44:39.138Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-harness-config-churn
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-harness-config-churn.md
  Leaves live only under a story. id is the filename stem: bug-harness-config-churn.
  CLI `arggon create bug harness-config-churn` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# harness-config-churn-blocks-start

## Context

`.zcode/config.json` was a **tracked** file that the ZCode harness rewrites during sessions (plugin registration, reformat — session state). `arggon start`'s clean-tree precondition refuses on modified tracked files, so every session had to stash → start → pop by hand (three sessions on 2026-09-29).

## Acceptance

- [x] Untracked `.zcode/` + `.zcodeignore` (26884b3b); shared `arggon mcp` registration stays tracked in `.mcp.json`; precondition still protects real edits (start.test.ts green + new `cli/src/harness-state.test.ts` invariants); real `start --worktree` verified green with dirty harness state.

## Notes

### 2026-09-30 @Arggon

### Repro + evidence (this session, 2026-09-29)

`.zcode/config.json` is a **tracked** file that the ZCode harness rewrites during sessions (session state). `arggon start`'s clean-tree precondition refuses to run while it is dirty — three separate agent sessions today had to `git stash push .zcode/config.json` → `start` → `stash pop` before claiming an item (worker on `task-review-verdict-checker`, coordinator twice). A pushed-after-stash dance is exactly the manual tracker git work the tooling exists to remove, and a naive agent will instead commit harness state or `--force` its way through (both worse).

### Candidate fixes (triage decided 2026-10-01: untrack + gitignore)

- [x] **Untrack + gitignore `.zcode/`** — CHOSEN. The only tracked content under `.zcode/` was `config.json`, whose sole content (the `arggon mcp` stdio registration) already lives **verbatim in the tracked `.mcp.json`** — nothing shared was lost, nothing needed moving. The harness demonstrably owns the file's lifecycle (rewrote it during sessions; see `bug-tsx-board-dead-script` session notes: "plugin registration + reformat — not mine"). ADR 0014 §2: `init` never writes a `.zcode/config.json` stanza for adopters, so no product contract makes this file repo config → no ADR needed (no contract change). The transient root-level `.zcodeignore` harness artifact (inspected: no tracked copy, no git history, not on disk at fix time — a harness-created/dropped file) is ignored alongside.
- [ ] ~~Allowlist (`x-tracker.clean-allowlist`)~~ — rejected: adds config + code surface (and a scope question: which paths, which statuses) to solve a one-line data problem, and leaves churn visible in `git status` forever. The precondition's job — protecting tracked edits from the claim commit — stays fully intact with no new knobs.
- [ ] ~~Document the stash dance~~ — rejected: fixes nothing; ritualizes the manual tracker git work the tooling exists to remove.

### Acceptance checklist

- [x] Decide the fix (untrack vs allowlist vs docs) — ADR not needed if untracking (no contract change).
- [x] Implement + test (clean-tree precondition keeps protecting real edits).
- [x] Verify a `start --worktree` succeeds with a dirty `.zcode/config.json` afterwards.

### 2026-10-01 @ses_f0aa6a0b5ffeZK4Oie0nnXQU7V
Fix landed: untrack + gitignore (branch fix/bug-harness-config-churn, commit 26884b3b).

DECISION — untrack + gitignore `.zcode/` + `.zcodeignore`. Only tracked content under `.zcode/` was `config.json`; its sole content (the `arggon mcp` stdio registration) exists verbatim in the tracked `.mcp.json` — nothing shared lost, nothing to move. The harness owns the file's lifecycle (rewrote it during sessions; cf. bug-tsx-board-dead-script session notes "plugin registration + reformat — not mine"). ADR 0014 §2: init never writes a `.zcode/config.json` stanza for adopters → no contract change → no ADR. Allowlist (x-tracker.clean-allowlist) rejected: machinery + config surface to solve a one-line data problem, churn stays visible in git status; precondition keeps protecting real edits unchanged. Docs-only rejected: fixes nothing.

GATES: vitest full suite 111 files / 1960 tests passed; npm run build OK with NO plugin-bundle drift (no regen commit needed); eslint clean; arggon validate ok (pre-commit gate green on both commits). New coverage: cli/src/harness-state.test.ts — 3 invariants: (1) nothing tracked under .zcode/, (2) .zcode/ + .zcodeignore ignored (full-list check catches partial gitignore regressions), (3) arggon registration stays in .mcp.json. start.test.ts green — precondition still refuses modified tracked files + untracked-in-tracker paths.

DIRTY-.zcode START VERIFICATION (real seam, two disposable clones of this repo, deleted after):
- Expected pre-fix (@ ff8ce2e5, file tracked) with harness-style rewrite: start refuses. Observed: "arggon start: working tree has changes that block start (commit or stash first): ... modified/staged tracked files ... .zcode/config.json" — bug reproduced.
- Expected post-fix (@ 26884b3b, same rewrite present, now ignored): start --worktree succeeds, claim commit carries only the item file. Observed: "worktree: /tmp/opencode/sv-postfix-task-start-verify-post-fix-scratch (created) / node_modules: linked from the primary checkout (the project gate can run in the worktree) / pushed" — EXIT=0; claim commit 9e369630 staged exactly the item file through the gate.
- Fresh clone: `git ls-files .zcode` is empty — no harness state resurrects. Migration for existing checkouts: the local .zcode/config.json stays on disk after pulling, now ignored; no action needed (recorded for the PR body).
