<!-- arggon:generated template="docs/claude/arggon/skills/arggon-cli/references/pitfalls.md" -->
# Pitfalls

Part of the `arggon-cli` skill (`SKILL.md`). Traps that have actually bitten
agents in this codebase — consult the matching entry when a trap applies.
The ordinary loop is `ArggonManager/docs/agents.md`; this is not required
reading for every tracker write.

## Tracker and claims

- `update --labels a,b` **REPLACES** the label list (kebab-case, unique). Same for
  `--depends-on a,b` (empty clears; `--add-depends-on <id>` appends; unknown ids
  fail). **Dependencies are advisory**: they gate `next`/`--ready` suggestions,
  never updates.
- Claim definition, lease, conflict and terminal-state policy:
  `ArggonManager/docs/convention.md` §Statuses. Do not infer availability from
  the primary checkout alone; the core's find step routes branch-claim checks.
- Acceptance grammar and leaf done gate:
  `ArggonManager/docs/convention.md` §Acceptance rows and §Transition matrix.
  Operational completion (including the merge): `ArggonManager/docs/agents.md` §5.
- Acceptance-aware ancestor completion: `ArggonManager/docs/convention.md`
  §Hierarchy. Use that contract rather than treating every checkbox in history
  as the item's live leaf acceptance.
- `comment`/`handoff` are body-only (frontmatter, including `updated`, is never
  touched) and are allowed on `done`/`cancelled` items: a comment is history, not
  a reopen. `handoff` fields are bounded.
- Tracker mutations (`create`, `update`, `comment`, `handoff`, `adopt`,
  `cleanup --prune`, `import-issues`) auto-commit only the files they wrote
  (`chore(tasks): ...`); opt out per call with `--no-commit`.

## Merging tracker-carrying PRs

- Tracker-commit staging, merge strategy and primary-push discipline:
  `ArggonManager/docs/agents.md` §0. If squash was unavoidable, recover with
  `git pull --rebase origin main` from the stale branch (enable rerere), or
  restart from fresh main; for stacked branches prefer `--no-commit`.
- **A claim branch cut from local HEAD inherits its unpushed commits: `start`
  reports `inheritedCommits` and the remedy — push main before the PR.**
  — bug-start-claim-branch-inherits-unpushed-tracker-commits
- Merge verification: `ArggonManager/docs/agents.md` §PR, review verdict and merge.
  Out-of-date/conflicting branches: `ArggonManager/docs/engineering.md`
  §Merging: a PR refused as out of date.

## Repo hygiene and staging

- Preparation and install diagnostics: `ArggonManager/docs/references/agent-runtime.md`
  §Worktree mechanics and §Native start dependency contract. Consult it for
  link farms, workspace builds, hook outcomes or a refused claim commit.
- **Stage explicit paths — never `git add -A` / `git add .`.** Directory patterns
  like `node_modules/` match directories only, so a `node_modules` SYMLINK to a
  shared install is untracked-but-not-ignored and `-A` commits it (a start-created
  link farm is a real directory, so the pattern does cover that case). Explicit paths also protect against sweeping unrelated dirty files
  into your commit. Tracker mutations stage surgically (`git add -- <path>` only);
  your own commits should do the same.
- A stale `dist` after a pull → `unknown option` errors: rebuild
  (`npm run build`) or run from source (`npm run arggon -- <command>`).
- `init` docs are never overwritten — even with `--force`; re-runs regenerate
  untouched generated docs silently, skip modified ones, and `--backup` archives
  them to `backup/<date>/`.
- **Expand brace elisions before an id check.** `arggon-{a,b}` hides every member from a substring guard — three live docs hid retired ids this way. — bug-zcode-agents-brace-elided-retired-ids
- `adopt` requires an initialized tree; it creates the migration task — executing
  it is an agent job per the checklist body.
- Conventions evolve: check `conventionVersion` in any envelope.
- **Leave it cleaner:** release expired claims (`update <id> --status todo`), prune
  merged worktrees (`arggon cleanup --prune`), flag stale playbooks, and keep the
  tree validating before every commit.

## Who decides — the human-only flags are named, not exceptions

The canonical authority map and promotion policy live in
`ArggonManager/docs/engineering.md` §Roles and authority / §Review bar.
Consult them when an operation needs a human-only power, not a workaround.
