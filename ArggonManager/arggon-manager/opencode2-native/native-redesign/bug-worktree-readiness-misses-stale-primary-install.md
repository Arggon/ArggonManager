---
type: bug
status: todo
id: bug-worktree-readiness-misses-stale-primary-install
title: "Worktree dependency prep reports ready: true while a declared devDependency is missing from the linked primary install"
parent: native-redesign
labels: [opencode-seam, worktree, install]
priority: p2
created: "2026-09-28"
updated: "2026-09-28"
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

- [ ] The preparation receipt distinguishes "linked install present" from "install satisfies the declared `devDependencies`", and a stale primary install is not reported as `ready: true` without a bounded explanation of what is missing.
- [ ] Name the concrete missing package(s) in the receipt (bounded, list-capped) so the fix is actionable without a diffing script.
- [ ] Document the remedy where the install is mirrored (re-install the primary, or give the worktree its own install) — in `ArggonManager/docs/agents.md` and/or the worktree section of `ArggonManager/docs/opencode2.md`.
- [ ] Keep the reported state non-fatal: a stale primary install must still produce a usable worktree, not a failed `start`.
- [ ] Add a deterministic test for a declared-but-uninstalled dependency: the receipt names it and readiness is not silently claimed.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin` and `arggon validate` are green.

## Notes

Found 2026-09-28 while reviewing PR #423. The immediate local remedy for the machine is
`npm install` in the primary checkout; the item exists because the _receipt_ claims readiness
that the gate then cannot use, which will recur for every future devDependency addition.

### 2026-09-29 @Arggon-coordinator
## FINAL APPROVE — PR #429 (`dfbd236c`), p2

Reviewed in two passes: the kernel logic first, then the native-payload loop I sent the worker back
for. I re-derived the design from the diff and re-measured the budget myself. **Merge authorized;
this comment performs no merge and no `done` flip.**

### What `satisfied` means, and why I accept the limit
`inspectDeclaredDependencies` is a **presence** check over the declared top-level
`dependencies` + `devDependencies`, resolved along the same `node_modules` walk-up Node itself uses
for a bare specifier, and the worker states precisely what it does **not** claim: versions are never
compared against ranges (pinned by a test — installed `1.0.0` against `^9.9.9` counts as provided),
transitive/peer/bundled deps are never walked, and `optionalDependencies` are excluded because
absence is what that field allows.

That honesty is what makes this mergeable. The tempting version of this fix verifies versions and
walks the graph, and it would either be wrong or become a package manager. A named gap with a stated
scope is a better engineering artifact than a real check that is quietly incomplete, and the doc
comment enumerates the exclusions where a future reader will look.

I checked one thing the worker did not emphasize: the resolution walk collects every existing
`node_modules` from the worktree up to `/`, so a dependency found in a parent directory counts as
provided. That is not a false positive — it is exactly the set Node consults at runtime, so
"present" here genuinely means "resolvable from this worktree".

### `ready` stays a conjunction
`ready = hasInstall && linkedWorkspaces.length === 0 && manifestCoverage === "satisfied"`. I agreed
with this over a parallel field and the worker's re-check (after the plugin edit) holds it up: the
preparation `ready` appears in exactly four non-test places, all inside the plugin (the receipt
type, `boundedPreparation`'s input type, its passthrough, and the failure literal), and every other
`ready` in the tree is the unrelated "ready items" lens flag or the board handle. **No consumer
branches on it** — the CLI never carried it at all. The verdict is honest without a second field,
and the reason for a `false` now travels in the same payload. The meaning change is documented in
five places rather than one, which is the right weight for a semantic change to a shared receipt.

### The loop I sent it back for, and why I insisted
The first pass made native *honest but silent*: `ready: false` reached the native caller while
`boundedPreparation` dropped the three fields that say why. The bug was reported **against the
native receipt** — a native caller is who was misled — and acceptance box 2 requires the names "so
the fix is actionable without a diffing script". Shelling out to the CLI to discover the missing
package is exactly the manual diffing the item exists to remove. Now the fields are projected, not
re-derived, and the kernel's cap is respected by *not* re-slicing (a second bound on an
already-bounded list is a second rule); a kernel-side truncation folds into the existing
`truncated` flag so a capped list is never passed off as the whole set, with the total carrying the
full count. The failure-path literal reports `unknown`/`[]`/`0` — it never claims `satisfied`.

### ADR 0006, measured by me
`npm run context:report` on the current primary: **native arggon tools (15, 9 pinned) → 11 821 B
≤ 12 288 B adv. pass** — byte-identical before and after, 467 B of headroom. This is a *result*
payload; no description, no input schema, no new definition, and the worker added a structural test
that the `start` schema string contains neither field name, so the property cannot rot silently.

### The BOM catch, and the discipline around it
Asked to confirm the new `ready: false` for an unparseable manifest, the worker went and measured
npm instead of arguing from memory — and found a real divergence: npm strips `^\uFEFF` (its own
`json-parse-even-better-errors`), so a BOM-ed `package.json` installs fine there while
`JSON.parse` would throw and report `unknown`, withholding readiness from a working install. The
fix is deliberately narrow: strip the BOM in `declaredDependencyNames` only, and leave the shared
`packageManifest` strict, because that helper feeds the link farm's entry detection where
accepting a workspace manifest would change *which copy resolves*. I verified both in the code
(`worktree.ts:622` strips; `:85-94` does not). Loosening a shared parser to fix a local symptom
would have been the easy wrong move.

### The documented cases now match the code
No `package.json` → declares nothing → `satisfied` (a dependency-free project keeps its readiness);
present but not readable as a JSON object → nothing compared → `unknown` / `ready: false`; readable
→ compared → `stale` or `satisfied`. `unknown` also covers "declares names but no
`node_modules` anywhere on the path", where no names are guessed because `install` already reports
the absent install. Comments and trailing commas stay `unknown`, which matches npm's
`EJSONPARSE`. That table is the difference between a contract and a hope.

### Scope and gates
Kernel + CLI + native plugin + four docs + tests. No `package.json`/`package-lock.json`, no
`smoke/**` edits (the worker ran `context:report` for the number and left the file alone), no new
dependency. 98 files / 1689 tests · `lint` · `build` (40 modules, 375 932 B) · `check:plugin`
exit 0 · `lint:structure` 0 findings · `test:structure` 3 passed · `validate --json` `ok:true`.
CI `36500973814` (`cli`, `ui-smoke`) and `36500974248` (`tasks-validate`) success on the final head.

### Disclosure that shaped my instruction
The worker's disclosure #3 is why the second loop existed, and the honesty was the right call —
flagging "I cannot complete this within my scope" instead of widening scope silently is exactly the
behavior this repo wants. `task-native-preparation-names-stale-deps` is now redundant; I am closing
it as superseded rather than leaving a stale obligation in the tracker.

### One honest limit the worker recorded
The stale path is proven by fixture, not on this machine: my `npm install` in the primary made the
real install current, so `inspectDeclaredDependencies(<this worktree>)` reports `satisfied`. That is
reported as observed rather than dressed up as a repro — correct, and the fixture covers the case
deterministically in CI.
