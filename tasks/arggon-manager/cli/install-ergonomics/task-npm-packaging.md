---
type: task
status: in_progress
id: task-npm-packaging
title: "npm packaging: files allowlist, prepare, executable bin"
assignee: Arggon
branch: feat/task-npm-packaging
parent: install-ergonomics
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-19"
claimed_at: "2026-09-19T20:09:40.777Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-npm-packaging
---
<!--
  Placement (v0): tasks/arggon-manager/cli/install-ergonomics/task-npm-packaging.md
  Leaves live only under a story. id is the filename stem: task-npm-packaging.
  CLI `arggon create task npm-packaging` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# npm packaging: files allowlist, prepare, executable bin

## Context

Found on 2026-09-18 while investigating side-by-side installs (see
`task-opencode2-side-by-side-installs`):

- No `files` field: `npm pack --dry-run` ships 973 files / 8.4 MB, including
  `dist/*.test.js` and other development artifacts.
- No `prepare`/`prepublishOnly`: `npm install -g <checkout>` does not build
  `dist/`, so installation only works when the tree was built beforehand.
- `npm run build` (tsc) leaves `dist/cli.js` at mode 644, so a manual symlink
  to the bin fails with `Permission denied`; `npm link` sets the exec bit, but
  the side-by-side shim needed a wrapper script (verified 2026-09-18).
- Both builds report version `0.3.0`, making parallel installs
  indistinguishable.

## Acceptance

- [x] `files` allowlist in `package.json` (production `dist/**` without
      `*.test.*`, `templates/`, `skills/`, `opencode/`, README/LICENSE) so
      `npm pack --dry-run` no longer includes tests or dev artifacts.
- [x] Clean install works from a fresh clone without pre-building (`prepare`
      builds `dist/`, or the supported install path is documented in README).
- [x] The bin is executable after `npm run build` (postbuild `chmod +x`) or the
      install flow guarantees it.
- [x] `arggon --version` identifies the build (e.g. version + git sha/branch)
      so side-by-side installs are distinguishable.
- [x] CI test pins the tarball contents (`npm pack --dry-run --json`) so
      bundling tests or dropping `dist` fails the gate.
- [x] Before/after size and file counts recorded in the item.

## Notes

- The side-by-side recipe docs live in the sibling task; this item is the
  packaging half.

### 2026-09-19 @Arggon
### Evidence — packaging before/after + install smoke (worker, 2026-09-19)

`npm pack --dry-run --json` (worktree, commit b300eb9):

| | before (opencode2 @6a03d8c) | after (b300eb9) |
| --- | --- | --- |
| tarball files | 977 | 164 |
| packed size | 8,355,167 B (7.97 MiB) | 322,741 B (0.31 MiB) |
| unpacked size | 12,474,559 B (11.90 MiB) | 1,089,052 B (1.04 MiB) |
| test artifacts (`.test.*` / `test-tmp.*`) | 225 | 0 |
| top level | cli, tasks, fixtures, docs, .github, dist, … | dist 113, templates 39, skills 8, opencode 1, README, LICENSE, package.json |
| `dist/cli.js` mode | 0644 | 0755 |

Fresh-clone smoke (real `git clone` of the branch — no `dist/` in the clone):
- `npm install` → `prepare` runs: builds `dist/cli.js` (0755) + `dist/build-info.json` = `{version: 0.3.0, sha: b300eb9, branch: feat/task-npm-packaging}`
- `npm pack` → `arggon-manager-0.3.0.tgz` (322,741 B, 164 entries)
- `npm install -g --prefix <tmp> ./arggon-manager-0.3.0.tgz` → `arggon --version` prints `0.3.0 (b300eb9, feat/task-npm-packaging)`; `arggon hello` OK
- manual `ln -s <checkout>/dist/cli.js` → runs (failed with `Permission denied` before)

Gates: `npm test` 79 files / 1307 tests green · `npm run lint` · `npm run build` · `arggon validate` ok:true.

Notes: npm 12 blocks a dependency's `prepare` by default, so README documents the tarball path (works with scripts blocked) and notes `npm run build` + `npm link` / `npm install -g .` for direct checkout installs. `--version` probes the work tree at runtime and falls back to the baked `dist/build-info.json`, so packed installs are identifiable too; git-less installs print the bare semver.

Pre-existing finding (not this PR): `cli/src/measure.test.ts` "always deletes the measurement temp tree (/tmp hygiene)" fails when another suite runs on the machine (shared `/tmp`); reproduces at base 6a03d8c without the new test files, and passes when no sibling suite is running. Coordinator to decide whether to file a follow-up.
