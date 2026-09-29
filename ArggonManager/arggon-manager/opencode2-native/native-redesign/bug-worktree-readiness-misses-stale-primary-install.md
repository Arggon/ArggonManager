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

- [x] The preparation receipt distinguishes "linked install present" from "install satisfies the declared `devDependencies`", and a stale primary install is not reported as `ready: true` without a bounded explanation of what is missing. (`ready` is the conjunction of the two old clauses and `manifestCoverage === "satisfied"`; the explanation is the sibling fields, carried by BOTH the native `preparation` payload and the CLI `--json` envelope.)
- [x] Name the concrete missing package(s) in the receipt (bounded, list-capped) so the fix is actionable without a diffing script. (`missingDependencies`, capped at the kernel's 10, plus the uncapped `missingDependenciesTotal`; projected into the native payload, not re-derived.)
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

### 2026-09-29 @Arggon
Follow-up loop closed: the native `preparation` payload now names the missing dependencies (PR #429, second commit `550f3575`; PR #428 merged first, so the branch also carries a merge of current main). Supersedes `task-native-preparation-names-stale-deps` (left `todo` for the coordinator to close as superseded).

**Native payload change and its bound.** `NativePreparationReceipt` + `boundedPreparation` (in `opencode/plugins/arggon/index.ts`) carry `manifestCoverage`, `missingDependencies` and `missingDependenciesTotal`. The values are PROJECTED from the kernel receipt, never re-derived: the only bound re-applied is the per-name character bound this function already applies to every other name in the receipt (`MAX_NATIVE_PREPARATION_VALUE_CHARS`), and the list is deliberately NOT re-sliced — the kernel caps it at `MAX_MISSING_DEPENDENCIES` = 10, which is below the plugin's own 32-name cap, so a second cap would be a second rule. A kernel-side truncation is folded into the existing `truncated` flag (`missingDependenciesTotal > missingDependencies.length`), so a capped list is never passed off as the whole set, and `missingDependenciesTotal` carries the full count. The failure-path literal (a preparation that threw) reports `unknown` / `[]` / `0` — never a `satisfied` claim, matching the kernel rule.

**ADR 0006 — result payload, not the catalog.** Measured with `npm run context:report` (which re-measures via the plugin's own `nativeToolsCatalogBytes()` helper):
- BEFORE the plugin edit: `native arggon tools (15, 9 pinned)  11,821 B  <=12,288 B adv.  pass`
- AFTER: `native arggon tools (15, 9 pinned)  11,821 B  <=12,288 B adv.  pass`
Byte-identical (467 B of headroom, unchanged). No tool description, no input schema, no new definition. A test also pins it structurally: `JSON.stringify(nativeToolSchemas().find(s => s.name === "start"))` contains neither `manifestCoverage` nor `missingDependencies`.

**New native tests** (`opencode/plugins/arggon/tools.test.ts`, 78 pass):
1. `names the declared dependencies a stale mirrored install cannot provide` — a seeded git tree with a committed root `package.json` declaring `dependencies: {native-gate-dep}` (installed) + `devDependencies: {@ast-grep/cli: 0.45.3}` (absent), a pre-commit gate requiring the installed dep. Native `start` → `preparation` = `{install: "linked", linkedNodeModules: true, ready: false, manifestCoverage: "stale", missingDependencies: ["@ast-grep/cli"], missingDependenciesTotal: 1}`, and non-fatal natively too: `ok: true`, `claimCommitted: true`, `claimCommit.status: "committed"`.
2. `caps the native missing-dependency list and reports the total behind the cap` — 13 declared-and-absent names → `manifestCoverage: "stale"`, `ready: false`, `missingDependencies` length `MAX_MISSING_DEPENDENCIES` (10, imported from the kernel, so the cap is pinned against the real number), `missingDependenciesTotal: 13`, `truncated: true`.

**Judgement question 1 — the unreadable-manifest case: kept, with one alignment.** The coordinator's reasoning holds and the divergence is real but narrow. Verified empirically against npm 11.x on this machine (`node/26.7.0`, `npm ls` in a scratch repo + npm's own parser module): comments → `EJSONPARSE` (both reject); trailing comma → `EJSONPARSE` (both reject); empty file → `EJSONPARSE` (both reject); **UTF-8 BOM → npm ACCEPTS** (npm's `json-parse-even-better-errors` strips `^\uFEFF`, and `npm ls` returns a manifest) while a bare `JSON.parse` throws; a non-object root (`"str"`, `null`, `[]`) is tolerated by npm with a synthesized name and was already tolerated here. So `unknown` → `ready: false` is honest for everything npm itself refuses, and the one case where we out-strictified npm (the BOM) is now fixed: the BOM is stripped in the coverage check only. The shared `packageManifest` helper stays strict on purpose — it feeds the link farm's entry detection, where accepting a workspace manifest would change which copy resolves. Documented and pinned by a new test (`reads a BOM-ed manifest npm also accepts, and still rejects what npm rejects`): BOM → `satisfied`, comment+trailing comma → `unknown`. The three cases, as documented in `ManifestCoverage` and `json-output.md`: no `package.json` → declares nothing → `satisfied` (so a dependency-free project keeps its readiness); present but not readable as a JSON object → nothing compared → `unknown`, `ready: false`; readable → compared, so `stale` when any name is missing and `satisfied` otherwise. `unknown` ALSO covers "declares names but no `node_modules` anywhere on the resolution path" — there is nothing to compare against, so no names are guessed (`install` already reports the absent install).

**Judgement question 2 — `ready` conjunction re-verified AFTER the plugin edit.** Yes, re-run: `grep` for every `.ready` / `ready:` / `if (…ready…)` in `cli/src`, `lib/src` and `opencode/plugins/arggon/index.ts` (bundle excluded). The preparation receipt's `ready` appears in exactly four non-test places, all in the plugin: the receipt type (2147), `boundedPreparation`'s input type (2196), the passthrough `ready: input.ready` (2222), and the failure literal `ready: false` (3212). Every other `ready` in the tree is the unrelated `next`/view-lens "ready items" flag (`lib/src/next.ts`, `lib/src/view-model.ts`, the `next` tool input, `cli/src/cli.ts`, `cli/src/mcp-server.ts`) or the board handle's `ready: Promise<void>`. No consumer branches on it — the CLI never even carried it — so the conjunction stands and now carries its reason into the same payload.

**Docs.** `opencode2.md` native `start` payload row now enumerates the full `preparation` field list including the three new fields, the 10-name cap and `truncated`, and no longer reads as if the native receipt omits them; `agents.md` (native `start` dependency contract) says both surfaces carry the names so neither caller shells out to the other; `playbooks/opencode.md`'s native bullet matches; `json-output.md` names the kernel cap as the shared bound. The BOM/`unknown` rule is stated in the `ManifestCoverage` doc comment and in `json-output.md`.

**Gates (all run in this worktree after the plugin edit).** `npm test` → 1689 passed / 98 files, 0 failed; `npm run lint` → clean; `npm run build` → ok (`40 modules inlined, 375932 bytes`); `npm run check:plugin` → exit 0 (bundle regenerated and byte-stable, no plugin-format churn: `opencode/plugins/arggon/` is prettier-ignored, so the edits were applied with python, not the session formatter); `npm run lint:structure` → exit 0, no findings; `npm run test:structure` → `PASS native-tools-use-shared-seam`, `PASS tracker-mutations-use-kernel`, `PASS tracker-rename-destination-use-kernel`, `test result: ok. 3 passed; 0 failed`; `npm run arggon -- validate --json` → `{"ok":true,"schemaVersion":1,"conventionVersion":5,"command":"validate","layout":"arggon-manager","errors":[],"warnings":[]}`; `npm run context:report` → exit 0.

### handoff 2026-09-29 @Arggon — next: Coordinator: review PR #429 (head 550f3575+, 2 commits on top of the merge of current main) and merge without squash; then update --status done.
- branch: fix/bug-worktree-readiness-misses-stale-primary-install
- open questions: Close task-native-preparation-names-stale-deps as superseded?; Is ready:false on an unreadable manifest acceptable, or should it be a distinct signal?
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
