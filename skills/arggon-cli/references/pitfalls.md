# Pitfalls

Part of the `arggon-cli` skill (`SKILL.md`). Traps that have actually bitten
agents in this codebase — read before mutating the tracker or merging.

## Tracker and claims

- `update --labels a,b` **REPLACES** the label list (kebab-case, unique). Same for
  `--depends-on a,b` (empty clears; `--add-depends-on <id>` appends; unknown ids
  fail). **Dependencies are advisory**: they gate `next`/`--ready` suggestions,
  never updates.
- `in_progress` on a claimable type without `assignee` is rejected;
  initiatives/epics may be `in_progress` unassigned.
- Claims carry a soft lease (`claimed_at`, ISO date-time) — reporting only.
  `list --stale --older-than 7d` reports stale claims. `update --steal --reason
"<why>" --assignee <you>` is **HUMAN-only** (agents refused behave like
  `--force`), double-gated: the repo must arm `x-tracker.allow-steal: true` and it
  must run at an interactive terminal with a y/N confirmation. Agents coordinate
  instead of stealing.
- `update --status blocked` requires `--blocked-reason`; `blocked_reason` is
  forbidden otherwise.
- **Cascade:** a terminal status (done/cancelled) auto-completes ancestor
  containers whose whole subtree is terminal — up to the initiative. Opt out with
  `--no-cascade`; flipped ids come back as `autoCompleted`. It is
  **acceptance-aware**: a container whose own body still has unchecked acceptance
  boxes is never auto-completed (reported as `cascadeSkipped`) — tick the checklist
  or pass `--no-cascade`.
- **Reopen is gated like steal** (bug-reopen-ungated-cli): `--status todo` on a
  `done`/`cancelled` item requires a y/N confirmation at an interactive terminal;
  non-TTY callers (agents, scripts, CI) are refused — no `--yes` override.
- `comment`/`handoff` are body-only (frontmatter, including `updated`, is never
  touched) and are allowed on `done`/`cancelled` items: a comment is history, not
  a reopen. `handoff` fields are bounded.
- Tracker mutations (`create`, `update`, `comment`, `handoff`, `adopt`,
  `cleanup --prune`, `import-issues`) auto-commit only the files they wrote
  (`chore(tasks): ...`); opt out per call with `--no-commit`.

## Merging tracker-carrying PRs

- **MERGE-merge, never squash.** Tracker mutations auto-commit locally on your
  branch; a squash merge rewrites them into one new commit on main while the
  branch's local auto-commits remain — the next pull on the stale branch diverges
  on identical content. If squash is unavoidable: `git pull --rebase origin main`
  from the stale branch (enable rerere), or delete the branch and restart from
  fresh main. For stacked/multi-item branches, prefer `--no-commit` and let the PR
  carry the tracker change.
- **Prevention beats recovery:** when mutating the tracker from the PRIMARY
  checkout (auto-commits land on local main), `git push origin main` immediately
  after every mutation — before opening or merging any PR — so the post-merge
  pull stays fast-forward.

## Repo hygiene and staging

- **Worktree starts prepare and keep the worktree** (bug-start-worktree-node-modules):
  `start --worktree` links the primary checkout's `node_modules` into a fresh
  worktree before the claim commit (additive `linkedNodeModules` in `--json`), so
  the wired pre-commit gate runs there — the old manual `git worktree add` +
  `ln -s` + re-run dance is gone. The link is untracked and NOT ignored
  (`node_modules/` matches directories only); start never commits it (the claim
  commit stages only the item file), and before a configured
  `x-worktree.post-start` hook runs start removes the link so `npm ci` cannot
  reify through it and empty the primary install, re-linking only when the hook
  leaves no `node_modules`. A failure after the worktree exists never rolls
  it back: the worktree and branch survive, the error names the failing step, path
  and remediation, and re-running `start --worktree` attaches and retries the
  failed claim commit (a failed push is the exception: push it manually, as the
  error says). Hooks are never bypassed. Discard an unwanted worktree with
  the command the error prints (`git worktree remove --force <path>`, plus
  `git branch -D <branch>` when start created the branch).
- **A linked worktree resolves workspace packages into the PRIMARY checkout.**
  The linked `node_modules` is the primary's whole install, so npm/workspace
  links inside it (`node_modules/@arggon/lib -> ../../lib`) resolve to the
  primary's copy even though the worktree carries its own: the spawned CLI and
  tests run the primary's build (stale when the worktree's copy differs,
  `ERR_MODULE_NOT_FOUND` when the primary was never built). `start --worktree`
  reports the shadowed packages as `linkedWorkspaces` in `--json` (plus a stdout
  note) — re-read after the `x-worktree.post-start` hook, so a hook that installs
  locally (the recommended `npm ci`) reports `[]`. To work against the worktree's
  own copy, give it a real local install (`npm ci`) instead of relying on the
  link; otherwise build where the imports resolve.
- **Stage explicit paths — never `git add -A` / `git add .`.** Directory patterns
  like `node_modules/` match directories only, so in worktrees where `node_modules`
  is a SYMLINK to a shared install it is untracked-but-not-ignored and `-A`
  commits it. Explicit paths also protect against sweeping unrelated dirty files
  into your commit. Tracker mutations stage surgically (`git add -- <path>` only);
  your own commits should do the same.
- A stale `dist` after a pull → `unknown option` errors: rebuild
  (`npm run build`) or run from source (`npm run arggon -- <command>`).
- `init` docs are never overwritten — even with `--force`; re-runs regenerate
  untouched generated docs silently, skip modified ones, and `--backup` archives
  them to `backup/<date>/`.
- `adopt` requires an initialized tree; it creates the migration task — executing
  it is an agent job per the checklist body.
- Conventions evolve: check `conventionVersion` in any envelope.
- **Leave it cleaner:** release expired claims (`update <id> --status todo`), prune
  merged worktrees (`arggon cleanup --prune`), flag stale playbooks, and keep the
  tree validating before every commit.
