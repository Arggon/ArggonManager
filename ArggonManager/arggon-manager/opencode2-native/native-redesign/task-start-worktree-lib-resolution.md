---
type: task
status: in_progress
id: task-start-worktree-lib-resolution
title: "Worktree resolution: flip @arggon/lib to the worktree copy"
assignee: Arggon
branch: feat/task-start-worktree-lib-resolution
parent: native-redesign
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-21"
claimed_at: "2026-09-21T23:15:13.852Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-start-worktree-lib-resolution
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-start-worktree-lib-resolution.md
  Leaves live only under a story. id is the filename stem: task-start-worktree-lib-resolution.
  CLI `arggon create task start-worktree-lib-resolution` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Worktree resolution: flip @arggon/lib to the worktree copy

## Context

Follow-up from the PR #384 review (`task-native-lib-hygiene`, finding 2). The
current fix documents and enforces the limit: a linked `node_modules` makes
`@arggon/lib` resolve to the **primary** checkout, and `start` reports the
affected workspace packages (`linkedWorkspaces`, additive). The real flip was
deferred because a link farm pointing `@arggon/lib` at the worktree copy needs
`<worktree>/lib/dist` **before** the claim commit's pre-commit gate — either
`start` builds the kernel (layering question) or
`bug-start-worktree-node-modules` regresses.

## Acceptance

- [x] Decide and implement one of: `start` builds the kernel before the gate,
      a per-worktree link farm with a pre-built `lib/dist`, or a documented
      permanent limit.
- [x] If flipped: tests cover a fresh worktree where the CLI resolves
      `@arggon/lib` to the worktree copy, and the pre-commit gate still runs.
- [x] Docs (`CONTRIBUTING`/`README`/`json-output`) and the skill match the
      behavior; no regression of `bug-start-worktree-node-modules`.
      `CONTRIBUTING`/`README`/`docs/agents.md`/`docs/convention.md` landed with
      the code; `docs/json-output.md` + `skills/arggon-cli/**` synced in
      `7beeedd` after the formatter worker's PR #387 merged (prettier-stable,
      prose guard green). `builtWorkspaces` stays stdout-only — the documented
      `--json` envelope is unchanged.
- [x] `arggon validate` green; CI green.

## Notes

- Filed from the PR #384 review; the current documented+enforced behavior is
  accepted meanwhile.

### 2026-09-21 @Arggon
Decision + implementation evidence (worker `Arggon`, branch
`feat/task-start-worktree-lib-resolution`, PR #388, commits 62bed48, 6c716ec,
38fff07, 58bfe82). The worker did not flip the item — the coordinator owns
done after merge.

## Decision (acceptance 1): link farm with a pre-built worktree copy

`start --worktree` now mirrors the primary install as a **per-worktree link
farm** (a real `node_modules` directory whose entries link the primary's
packages) and points every workspace package the worktree carries a copy of at
the **worktree copy**. Before the claim commit, a copy whose declared entry
(`exports["."]`/`main`) is missing is built with the package's own `build`
script, so the pre-commit gate loads the branch's kernel. A copy that cannot be
built (no script, failing build, missing entry) keeps the primary's copy and is
reported by `linkedWorkspaces` — `bug-start-worktree-node-modules` cannot
regress. The rule is generic npm-workspace knowledge (same shape as
`linkedWorkspacePackages`), not kernel-specific: no hardcoded `@arggon/lib` and
no new config key or CLI flag.

Rejected alternatives, with measured evidence:

- Option "start builds the kernel by name": the CLI would have to know the
  kernel; the farm's pre-build uses each package's own `build` script instead
  (2.0 s for this repo's kernel).
- Option "documented permanent limit": a farm is compatible with the toolchain.
  Verified in a scratch tree: `npm ci` over a farm reifies normally (6.3 s
  warm), `vitest`/`eslint`/`npm run build` work, the farm is a real directory so
  the repo's `node_modules/` ignore pattern covers it, and `git worktree remove`
  removes it without an unlink dance.

## Before / after (real CLI + real pre-commit gate, fresh worktree)

Before: `@arggon/lib` resolved to `<primary>/lib/dist/index.js` and `start`
printed the `linkedWorkspaces` note. After (fresh clone, scratch bare origin,
`start --worktree` on a claimed item):

```
node_modules: linked from the primary checkout (the project gate can run in the worktree)
workspace: built @arggon/lib from the worktree copy (the install resolves it worktree-locally)
```

Observed (all paths in the fresh worktree):

- the pre-commit hook's own `require.resolve('@arggon/lib')` record:
  `<wt>/lib/dist/index.js` — the gate (before the claim commit) loaded the
  branch's kernel, not the primary's
- resolution from the CLI entry (`createRequire('<wt>/cli/src/cli.ts')`):
  `<wt>/lib/dist/index.js`
- install shape: `node_modules` is a real directory;
  `node_modules/@arggon/lib -> <wt>/lib`; `node_modules/tsx -> <primary>/node_modules/tsx`
- `git status --porcelain` in the fresh worktree lists no `node_modules`
  (the farm directory is ignored); the claim commit still stages only the item
  file
- negative proof: deleting `<wt>/lib/dist/index.js` makes the spawned CLI fail
  with `ERR_MODULE_NOT_FOUND ... <wt>/node_modules/@arggon/lib/dist/index.js` —
  there is no silent fallback to the primary's build
- `start` wall time 3.4 s total (kernel build included)

## Tests (acceptance 2)

- `cli/src/worktree.test.ts` (+4): fresh-worktree flip with the gate proving
  the resolution; no-build-script and failing-build fallbacks keep the primary
  and report; `cleanup --prune` removes a farm worktree without following its
  entries into the primary install.
- `cli/src/start.test.ts` (+5): farm creation/ownership, `unlinkNodeModulesLink`
  removes a farm without touching the primary (foreign marker ignored),
  `buildLocalWorkspaces` flips only after the entry exists, `pointWorkspaceAtLocal`
  never rewrites an npm-reified install.
- Mutation-verified twice: disabling the farm (`if (false && …)`) or the
  pre-build (`builtWorkspaces = []`) makes the flip test fail.

## Docs (acceptance 3, partially blocked)

Landed: `README.md`, `CONTRIBUTING.md`, `ArggonManager/docs/agents.md`,
`ArggonManager/docs/convention.md` (`x-worktree`). **Pending coordination**:
`ArggonManager/docs/json-output.md` (`linkedNodeModules` row + the `start`
prose: "Because that link is the primary checkout's whole install, workspace
packages inside it resolve to the primary copy") and `skills/arggon-cli/**`
(`SKILL.md` claim step, `references/pitfalls.md`, `references/orchestration.md`)
still describe the old whole-install link. Both are claimed by the parallel
formatter worker, so they were deliberately not touched. No `--json` field was
added — `builtWorkspaces` is human stdout only — so the documented envelope
shape is unchanged; only that prose needs the farm + pre-build + fallback
wording.

## Gates (acceptance 4)

`npm run build` ✅ · `npm test` **1475/1475 (90 files)** ✅ · `npm run lint` ✅ ·
`npm run check:plugin` ✅ (bundle regenerated) · `npm run arggon -- validate` ✅
v5 · `npm run arggon -- spec validate` ✅ 18 · prettier ✅ on every touched
source file. One full-suite run failed `cli/src/measure.test.ts`'s `/tmp`
hygiene assertion — the pre-existing `bug-measure-tmp-hygiene-flake` triggered
by the parallel suite on shared `/tmp` (passes alone and in the final full run;
the flake's own item documents the repro at base).
CI on `58bfe82`: `cli` pass (4m20s, run 35668758947) + `tasks-validate` pass
(35s, run 35668758951).

### handoff 2026-09-21 @Arggon — next: Review draft PR #388 (link farm + pre-claim build; 1475 tests, CI green). Coordinate the json-output.md/skill sync with the formatter worker, then merge (merge commit) and flip done.
- branch: feat/task-start-worktree-lib-resolution
- open questions: json-output.md + skills/arggon-cli/** still describe the whole-install link (formatter worker's scope) — sync after their PR lands, or authorize me to update them?; start pre-builds every shadowed wo…

### 2026-09-21 @Arggon
CI follow-up: the code tip `58bfe82` was already green, and the tracker tip
`d604631` (this comment's parent: the two `chore(tasks)` commits) is green too —
`cli` pass (4m9s, run 35669216643) + `tasks-validate` pass (37s, run 35669216660).
No further commits are planned from this worker; the next tip move is the
coordinator's review/merge.

### 2026-09-22 @Arggon
Acceptance 3 closed (resume after the formatter worker's PR #387 merged into
`opencode2`).

- `09b7254` merge of `origin/opencode2` — clean; #387's prose repairs and
  `cli/src/prose-format.test.ts` guard are in.
- `7beeedd` sync: `ArggonManager/docs/json-output.md` (`linkedNodeModules` row →
  per-worktree link farm, or a bare symlink when no workspace package is
  shadowed; `linkedWorkspaces` row → only what stayed on the primary's copy,
  with the pre-build and the visible fallback; `start` prose → worktree-local
  resolution), `skills/arggon-cli/SKILL.md` (claim step),
  `references/pitfalls.md` (prepare/keep bullet, the resolution bullet, the
  staging nuance) and `references/orchestration.md` (worktrees in practice).
- `builtWorkspaces` remains **stdout-only**: the documented `--json` envelope is
  unchanged (no field, no row).
- The json-output table keeps the base's canonical prettier width, so the diff is
  3 semantic lines (two rows + the `start` prose). `npm run skills:sync`
  regenerated the 6 bundled copies (gitignored);
  `prose-format.test.ts` + `skill-copy.test.ts` + `skill-generated-commands.test.ts`
  are green.
- Coordinator decision recorded in the skill/doc: start pre-builds **every**
  shadowed workspace package that declares a `build` script and whose declared
  entry is missing — deliberate default (a local copy is preferred whenever it
  exists; a failed build falls back visibly to the primary and `linkedWorkspaces`
  names it). No opt-out today; a per-invocation skip is noted as a candidate
  follow-up.

Gates after the sync: `npm run build` ✅ · `npm test` **1490/1490 (92 files)** ✅ ·
`npm run lint` ✅ · `npm run check:plugin` ✅ (bundle 337936 B, no drift) ·
`npm run arggon -- validate` ✅ v5 · `npm run arggon -- spec validate` ✅ 18 ·
prettier ✅ on the four touched files (byte-stable where the guard pins it).
