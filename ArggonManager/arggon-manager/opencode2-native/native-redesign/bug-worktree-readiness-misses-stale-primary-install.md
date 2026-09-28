---
type: bug
status: in_progress
id: bug-worktree-readiness-misses-stale-primary-install
title: "Worktree dependency prep reports ready: true while a declared devDependency is missing from the linked primary install"
assignee: Arggon
branch: fix/bug-worktree-readiness-misses-stale-primary-install
parent: native-redesign
labels: [opencode-seam, worktree, install]
priority: p2
created: "2026-09-28"
updated: "2026-09-28"
claimed_at: "2026-09-28T23:16:15.651Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-worktree-readiness-misses-stale-primary-install
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-worktree-readiness-misses-stale-primary-install.md
  Leaves live only under a story. id is the filename stem: bug-worktree-readiness-misses-stale-primary-install.
  CLI `arggon create bug worktree-readiness-misses-stale-primary-install` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Worktree dependency prep reports ready: true while a declared devDependency is missing from the linked primary install

## Context

`tools.arggon.start` prepares a fresh worktree with `prepareWorktreeDependencies`
(`lib/src/worktree.ts`), which links the **primary's** `node_modules` as a per-worktree link
farm and reports a receipt. On this machine the receipt says the worktree is ready while a
declared devDependency is not installed anywhere it can be resolved from:

- `package.json` declares `@ast-grep/cli` at exactly `0.45.3` (merged with PR #418).
- `node_modules/@ast-grep` is **absent** in the primary checkout.
- `tools.arggon.start` still returned `{ "ready": true, "install": "linked", "linkedNodeModules": true, "builtWorkspaces": ["@arggondev/lib"], "linkedWorkspaces": [] }`.

So `ready: true` currently means "a linked `node_modules` exists and no workspace package
resolves into the primary" — it says nothing about whether the install actually satisfies
`package.json`. Two workers on 2026-09-28 hit this: the PR #423 worker could not run
`npm run lint:structure` / `npm run test:structure` at all (the scripts invoke `ast-grep`,
absent from the install; it failed identically on the untouched claim commit), and the PR #422
worker fell back to running the same pinned `0.45.3` through the npx cache. CI is the only thing
that actually ran the guard.

The link farm is a deliberate design (it is what makes the pre-commit gate work in a cold
worktree — `bug-native-start-worktree-no-install`), so the fix is not "stop linking". It is
that a merged devDependency is invisible in every worktree until the primary is re-installed,
and the receipt presents that state as ready.

## Acceptance

- [x] The preparation receipt distinguishes "linked install present" from "install satisfies the declared `devDependencies`", and a stale primary install is not reported as `ready: true` without a bounded explanation of what is missing.
- [x] Name the concrete missing package(s) in the receipt (bounded, list-capped) so the fix is actionable without a diffing script.
- [x] Document the remedy where the install is mirrored (re-install the primary, or give the worktree its own install) — in `ArggonManager/docs/agents.md` and/or the worktree section of `ArggonManager/docs/opencode2.md`.
- [x] Keep the reported state non-fatal: a stale primary install must still produce a usable worktree, not a failed `start`.
- [x] Add a deterministic test for a declared-but-uninstalled dependency: the receipt names it and readiness is not silently claimed.
- [x] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin` and `arggon validate` are green.

## Notes

Found 2026-09-28 while reviewing PR #423. The immediate local remedy for the machine is
`npm install` in the primary checkout; the item exists because the _receipt_ claims readiness
that the gate then cannot use, which will recur for every future devDependency addition.

### 2026-09-28 @Arggon
Implementation is on `fix/bug-worktree-readiness-misses-stale-primary-install` (PR #429, draft). Acceptance ticked per box, expected vs observed:

**1. Distinguishes "linked install present" from "install satisfies the declared deps".** Expected: a stale primary install is never `ready: true` without a bounded explanation. Observed: the kernel receipt gained `manifestCoverage: "satisfied" | "stale" | "unknown"` and `ready` is now the conjunction of its two old clauses AND `manifestCoverage === "satisfied"` (`lib/src/worktree.ts`). Documented in the type, `ArggonManager/docs/agents.md` §4 + Native `start` dependency contract, `ArggonManager/docs/opencode2.md`, `ArggonManager/docs/playbooks/opencode.md`, `ArggonManager/docs/json-output.md` — never silently. The clause reaches the native surface with no plugin edit: nothing branches on `ready`, and `boundedPreparation` forwards it as-is.

**What "satisfies the declared devDependencies" means here — and what it does NOT claim.** `satisfied` = every declared top-level `dependencies` + `devDependencies` NAME resolves through the `node_modules` on the worktree's resolution path (its own, then each parent's — the order Node uses for a bare specifier). It is a PRESENCE check over that set, not an install verification: installed versions are never compared against the declared ranges, transitive/peer/bundled dependencies are never inspected, and `optionalDependencies` are excluded on purpose (being absent is what that field allows). `unknown` means nothing was compared (no install on the path, or an unreadable manifest) and is never reported as `satisfied`. All stated verbatim in the `ManifestCoverage` doc comment and `json-output.md`.

**2. Names the missing packages, bounded.** Observed: `missingDependencies` (sorted, capped at `MAX_MISSING_DEPENDENCIES = 10`) + `missingDependenciesTotal` (the uncapped count, so a truncated list is never mistaken for the whole set). Present in the kernel receipt, in `arggon start --worktree --json`, and in the stdout note; the CLI note also carries the remedy.

**3. Remedy documented where the install is mirrored.** Observed: `ArggonManager/docs/agents.md` §4 ("re-install the primary checkout (`npm install` *in it* — never `npm ci` through a link to it) or give the worktree its own install (`npm ci` in the worktree, e.g. via `x-worktree.post-start: npm ci`)"), with `opencode2.md` (worktree payload table) and `playbooks/opencode.md` pointing at it, plus the same sentence in the CLI stdout note and `json-output.md`.

**4. Non-fatal.** Observed: `cli/src/worktree.test.ts` — with `gate-dep` installed and `@ast-grep/cli` declared-but-absent, `start --worktree` still returns `linkedNodeModules: true`, `committed: true`, and the worktree + item file are there; `cli/src/cli.test.ts` asserts the same through the real CLI (exit 0). Nothing in either surface branches on `ready` (grepped: only `boundedPreparation`'s passthrough), so the claim-commit outcome stays authoritative.

**5. Deterministic test for a declared-but-uninstalled dependency.** Observed (`lib/src/worktree.test.ts`, no package manager involved): a worktree manifest declaring `gate-dep` (installed) + `@ast-grep/cli` (absent) against a primary install that gets linked in →
`{ install: "linked", linkedNodeModules: true, ready: false, manifestCoverage: "stale", missingDependencies: ["@ast-grep/cli"], missingDependenciesTotal: 1, builtWorkspaces: [], linkedWorkspaces: [] }`.
Plus: satisfied case; the 10-name cap with `missingDependenciesTotal: 13`; presence-not-version (installed 1.0.0 against `^9.9.9`) and absent-`optionalDependencies` → `satisfied`; unreadable manifest → `unknown`; `inspectDeclaredDependencies` unit tests including the parent-install walk-up. Plus `cli/src/worktree.test.ts` (stale + a post-start hook that installs locally flipping it back to `satisfied`) and `cli/src/cli.test.ts` (JSON fields + the human note naming the dependency and `npm ci`).

**6. Gates** (all run in this worktree, real output): `npm test` → 1670 passed / 97 files, 0 failed; `npm run lint` → clean; `npm run build` → ok (`40 modules inlined, 375005 bytes`); `npm run check:plugin` → exit 0 (bundle committed and byte-stable); `npm run lint:structure` → exit 0, no findings; `npm run test:structure` → `PASS native-tools-use-shared-seam`, `PASS tracker-mutations-use-kernel`, `PASS tracker-rename-destination-use-kernel`, `test result: ok. 3 passed; 0 failed`; `npm run arggon -- validate --json` → `{"ok":true,"schemaVersion":1,"conventionVersion":5,"command":"validate","layout":"arggon-manager","errors":[],"warnings":[]}`.

Not verified / disclosed:
- The machine's real state is `satisfied` (the coordinator ran `npm install` in the primary), so the stale path is proven by fixtures, not by this machine: `inspectDeclaredDependencies(<this worktree>)` → `{"coverage":"satisfied","missing":[],"missingTotal":0}`. The stale case is reproduced deterministically in the fixture above, as the item asked.
- `opencode/plugins/arggon/index.bundle.ts` is **regenerated** in this diff (the bundle inlines `@arggondev/lib`, so the kernel change appears there); no plugin source was edited. The worker owning the plugin in this wave will regenerate the same file — whoever merges second only needs `npm run build:plugin`.
- The native payload does not yet carry the three new field names: `boundedPreparation` (plugin file, out of scope in this wave) projects fields explicitly, so it forwards `ready` but drops them. A native caller gets "not ready" without the names — filed as `task-native-preparation-names-stale-deps` (p3) with context and an acceptance checklist.

### handoff 2026-09-28 @Arggon — next: Coordinator: review PR #429 and merge (do not squash); then update --status done. If a plugin PR also regenerated index.bundle.ts, re-run npm run build:plugin after the merge.
- branch: fix/bug-worktree-readiness-misses-stale-primary-install
- open questions: Should ready stay the conjunction, or split into a separate readiness field?; Is p3 right for the native payload projection follow-up?
