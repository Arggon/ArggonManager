---
type: task
status: in_progress
id: task-opencode2-side-by-side-installs
title: "OpenCode2 side-by-side installs: named shim + per-project PATH"
assignee: Arggon
branch: feat/task-opencode2-side-by-side-installs
parent: install-ergonomics
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-19"
claimed_at: "2026-09-19T20:09:29.372Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-side-by-side-installs
---
<!--
  Placement (v0): tasks/arggon-manager/cli/install-ergonomics/task-opencode2-side-by-side-installs.md
  Leaves live only under a story. id is the filename stem: task-opencode2-side-by-side-installs.
  CLI `arggon create task opencode2-side-by-side-installs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode2 side-by-side installs: named shim + per-project PATH

## Context

Investigated 2026-09-18 for an adopter who wants `main` and `opencode2`
installed at once. Both branches declare the same `arggon` bin, so two
`npm link` installs collide; the global shim points at the last-linked
checkout. Verified options on this machine:

- **A (recommended): named shim + per-project PATH via mise.** Keep `arggon`
  → main; add `~/.local/share/arggon-oc2/bin/arggon` (wrapper:
  `exec node <checkout>/dist/cli.js "$@"`, immune to the tsc exec-bit) and
  `~/.local/bin/arggon-oc2`; in the project, `mise.local.toml` with
  `[env] _.path = ["~/.local/share/arggon-oc2/bin"]` makes bare `arggon`
  resolve to opencode2 inside the project (mise prepends before the Node bin
  dir; verified with `mise exec`).
- **B: isolated npm prefix.** `npm install -g --prefix ~/.local/share/arggon-oc2
<checkout>` produces a frozen copy with its own `bin/arggon` (works because
  npm 12 packs `dist/`; see `task-npm-packaging` for the packaging debt).
- Caveats found: a direct symlink to `dist/cli.js` fails after `tsc` (644);
  the OpenCode server inherits the PATH of the shell that launched it, so a
  server started elsewhere still resolves bare `arggon` to main (relaunch from
  the project or pin the MCP command); `.opencode/plugins/arggon/index.ts` and
  `.agents/skills/*` are gitignored generated copies, so a fresh dev clone
  needs `arggon init` (or the parity tests) before the plugin appears in
  `Ctrl+P → Plugins`.

## Acceptance

- [ ] `docs/opencode2.md` gains a "Side-by-side installs" section documenting
      both recipes, with the exact commands verified here.
- [ ] It states the `mise.toml` (tracked, inherited by worktrees and clones)
      vs `mise.local.toml` (machine-local, worktrees do not inherit it)
      trade-off and recommends the tracked file for oc2 projects.
- [ ] It explains why bare `arggon` must resolve per project (MCP command,
      skills, plugin) and the launch-dir/server-env caveat.
- [ ] Verification steps included: `which arggon`, `Ctrl+P → Plugins`,
      `opencode api plugin.list`.
- [ ] The tsc exec-bit gotcha and the generated-copies bootstrap are stated in
      the dev setup path.
- [ ] Docs only — no repo code changes required.

## Notes

- Option A is already mounted locally (wrapper + `arggon-oc2` +
  `mise.local.toml` in the opencode2 checkout, git-excluded); the docs should
  reproduce it.
- Verified end-to-end in a fresh scratch project (2026-09-19): `mise.toml`
  tracked → `arggon init` from the oc2 build, plugin generated, headless
  `opencode run` activated the location, `plugin.list` → `arggon` local
  `active`, `mcp.list` → `arggon` `connected`.

### 2026-09-19 @Arggon
Docs-only implementation in worktree ../ArggonManager-opencode2-task-opencode2-side-by-side-installs — commit 8175ad2, draft PR #365 (base opencode2). docs/opencode2.md gains 'Side-by-side installs' (Option A named shim + per-project PATH; Option B frozen prefix; mise.toml vs mise.local.toml table; why bare arggon must resolve per project + server-PATH caveat; dev-checkout bootstrap; verification block) and docs/playbooks/opencode.md gains a Setup cross-ref. No code changes; no generated-marker files touched.

Evidence (2026-09-19, this machine):
- Option A reproduced from zero in a scratch git tree with tracked mise.toml: 'mise exec -- which arggon' -> ~/.local/share/arggon-oc2/bin/arggon in the project AND in a linked 'git worktree add' copy; the primary's mise.local.toml is NOT inherited by worktrees. Raw shell without mise still resolves main.
- Option B nuance: on npm 12.0.2 'npm install -g --prefix <dir> <checkout>' LINKS the checkout (not frozen); documented '--install-links' (or a tarball install) yields a real copy at <prefix>/lib/node_modules/arggon-manager/dist/cli.js. 'npm pack' includes dist/ because it follows the declared bin into the gitignored dir.
- 'opencode api plugin.list --param location[directory]=$PWD' -> argon local active; mcp.list -> connected. Bare 'arggon mcp' spawned by the running server resolved to MAIN even under the oc2 checkout (observed: node .../node/26.7.0/bin/arggon mcp); pinning the shim in the MCP command spawned the oc2 dist/cli.js.
- 'npm run build' leaves dist/cli.js at mode 644 (tsc exec-bit gotcha).
- Gates: npm test 1293 passed (final run), npm run lint clean, npm run arggon -- validate ok (convention v3). Earlier npm test runs flaked in cli/src/measure.test.ts while load average was ~26 from parallel agents (hygiene test races concurrent measureBudget callers; fixture subprocess exit 1 under load); the file passes isolated, so environmental.

### handoff 2026-09-19 @Arggon — next: Coordinator review + merge of PR #365 (draft). Merge with a merge commit, not squash: the branch carries chore(tasks) auto-commits (claim, comment, handoff). After merge: tick the acceptance boxes if…
- branch: feat/task-opencode2-side-by-side-installs
- open questions: Pre-existing flake: cli/src/measure.test.ts '/tmp hygiene' races concurrent measureBudget callers (cli.test.ts doctor --budget) and fixture subprocesses exit 1 under high parallel-agent load; passes …
