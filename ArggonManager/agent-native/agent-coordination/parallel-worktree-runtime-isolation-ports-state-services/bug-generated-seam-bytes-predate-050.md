---
type: bug
status: done
id: bug-generated-seam-bytes-predate-050
title: "The generated OpenCode seam bytes are one release behind: the vendored plugin copy predates 0.5.0, so the live native surface has none of the worktree-isolation features"
assignee: Arggon
branch: fix/bug-generated-seam-bytes-predate-050
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam, release]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-generated-seam-bytes-predate-050.md
  Leaves live only under a story. id is the filename stem: bug-generated-seam-bytes-predate-050.
  CLI `arggon create bug generated-seam-bytes-predate-050` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The generated OpenCode seam bytes are one release behind: the vendored plugin copy predates 0.5.0, so the live native surface has none of the worktree-isolation features

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @ses_f03213cdbffeJ4RqV9JXfur867
Found by a 0.5.0 adoption audit (2026-10-02, coordinator session).

## Context

The committed source seam is current — `opencode/plugins/arggon/index.bundle.ts` (rebuilt
Oct 2 09:37) carries every v0.5.0 worktree-isolation feature. The **vendored copy that OpenCode
actually loads**, `.opencode/plugins/arggon/index.ts`, is a generated copy of that bundle (its own
provenance header says `arggon:generated template="opencode/plugins/arggon/index.bundle.ts"`)
dated **Oct 1 09:52** — i.e. it predates the final 0.5.0 state.

Marker counts, vendored copy vs current bundle:

| marker | vendored copy | current bundle |
| --- | --- | --- |
| `foreignWrites` (single-writer detection, #568) | 0 | 17 |
| `arggon-claim.json` (claim stamp, #568) | 0 | 2 |
| `ARGGON_WORKTREE_ID` (env contract, #566) | 0 | 2 |
| `docker compose` (prune reaping, #569/#574) | 0 | 1 |
| `gateBins` (#517, extended in #533) | 11 | 20 |
| `manifestCoverage` (#551) | 3 | 3 |

So the `tools.arggon.*` surface this session actually calls has **none** of the v0.5.0
worktree-isolation capabilities: no claim stamp, no `claim.foreignWrites`, no `.arggon.env` contract,
no compose reaping, no take-over input. Observable corroboration: the native `start` tool schema in
this session has no `takeOverWorktree` input — which is separately tracked as
task-native-start-take-over-input (PR #579, open).

The existing drift gate (`npm run check:plugin`, plus `cli/src/plugin-copy.test.ts`) only covers
the **bundle**, never the vendored copy, so the copy can rot silently across a release. The file is
gitignored by design (generated artifact), so nothing in the tree or in CI notices.

Same root-cause class, second site: `skills/arggon-cli/SKILL.md` frontmatter still reads
`version: 0.4.0` while `package.json` is `0.5.0`. The `x-generated` stamps in
`ArggonManager/.convention.yml` do say `arggonVersion: "0.5.0"`, so only the hand-set frontmatter
field drifted.

## Acceptance

- [x] `.opencode/plugins/arggon/index.ts` regenerated from the current bundle: `foreignWrites`, `arggon-claim.json`, `ARGGON_WORKTREE_ID` and the compose-prune call all present, and its provenance header matches the bundle build that produced it. Evidence: the copy on this machine went 402,005 -> 438,833 bytes; marker counts after the refresh: `foreignWrites` 19 (was 0), `arggon-claim.json` 2 (was 0), `ARGGON_WORKTREE_ID` 2 (was 0), `docker compose` 1 (was 0), `gateBins` 20 (was 11). Byte-identity was proven against a scratch `init` rather than assumed: init's output equals `// arggon:generated template="opencode/plugins/arggon/index.bundle.ts"\n` + the bundle bytes, which is exactly what was written. (`takeOverWorktree` is still absent — it ships in the open #579.)
      `arggon-claim.json`, `ARGGON_WORKTREE_ID` and the compose-prune call all present, and its
      provenance header matches the bundle build that produced it.
- [x] `npm run check:plugin` green, and a regression check exists that fails when the vendored copy is older than the bundle (the copy is untracked, so the check must compare content/provenance, not git timestamps). Evidence: `check:plugin` exit 0 (bundle unchanged — this item is not about the artifact). The new check is `arggon doctor` → `opencode.plugin` (`present` / `comparable` / `current` / `skillVersion` + a hint), rendered as `vendored plugin current` / `STALE` / `unverified` / `no vendored plugin`. It compares CONTENT (marker + bundle bytes), never mtimes, and reports `unverified` rather than `stale` when the tree has no local bundle — a plain adopter tree vendors from the installed package, where freshness is npm's business. Two new cases in `cli/src/doctor.test.ts` (49 -> 51, green), each negative-controlled: the stale case writes older bytes and the hint appears; the skill case writes `version: 0.0.1` against a `9.9.9` package.
      is older than the bundle (the copy is untracked, so the check must compare content/provenance,
      not git timestamps).
- [x] Documented in `ArggonManager/docs/agents.md` (or the CLI skill): after pulling a new release, a session must refresh the generated seam bytes before it may rely on new native capabilities — the catalog it loaded is whatever was on disk at session start. Evidence: agents.md gained a "The generated seam bytes are what your session runs" bullet stating the refresh command (`arggon init`, or `npm test` which rewrites the copy), the session restart requirement, and how to read doctor's three states.
      session must refresh the generated seam bytes before it may rely on new native capabilities —
      the catalog it loaded is whatever was on disk at session start.
- [x] `skills/arggon-cli/SKILL.md` frontmatter `version:` bumped to match the release, with whatever drift guard keeps it in step. Evidence: `skills/arggon-cli/SKILL.md` `version: 0.4.0` -> `0.5.0` (the source; `.agents/skills/**` is the gitignored generated copy). The drift guard is doctor's `skillVersion`/`skillVersionMatches` comparison against the root `package.json`, reported as a hint — with the deliberate rule that a tree WITHOUT a root `package.json` is never reported as drift (init writes none).
      drift guard keeps it in step.
- [x] Evidence recorded on the item: the marker-count table above, re-run after the refresh. Evidence: see box 1's post-refresh counts; the pre-refresh numbers are in the finding's table. One surprise worth recording: adding the freshness check initially BROKE the packed-install lane (`headless-ci`: `expected 1 to be +0`) because `doctor.ts` imported `PLUGIN_BUNDLE` from `plugin-bundle.ts`, which imports the TypeScript compiler API — `typescript` is a devDependency, so a packaged install could not load the CLI at all (`ERR_MODULE_NOT_FOUND: Cannot find package 'typescript'`). Fixed by moving the two seam paths into an import-free `cli/src/plugin-paths.ts` (re-exported from `plugin-bundle.ts` so there is one source of truth); `dist/doctor.js` no longer references the compiler module and the lane is green. That is the lane earning its keep on a change that had nothing to do with packaging.

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
verdict: approve — the p1 is closed on both halves: this machine's vendored seam now carries every 0.5.0 capability (plus #579's `takeOverWorktree`, verified after that merge: 443,311 bytes, `foreignWrites` 19, `arggon-claim.json` 3, `ARGGON_WORKTREE_ID` 2, `docker compose` 1, `takeOverWorktree` 7), and the class can no longer rot silently. `arggon doctor` grew an `opencode.plugin` block (`present` / `comparable` / `current` / `skillVersion` / `skillVersionMatches` / `hint`) rendered as `vendored plugin current` | `STALE` | `unverified` | `no vendored plugin`, and the skill's frontmatter version is now compared against the release.

Two design points I insisted on after the first cut failed its own tests: (1) the comparison is CONTENT (marker line + bundle bytes), never mtimes — git cannot see an ignored file's age, so a timestamp check would be theatre; (2) `unverified` is a real third state, not a softened `stale`: in a plain adopter tree `init` vendors from the INSTALLED package and there is no local bundle to compare, so freshness there is npm's business. The same rule governs the skill version — a tree with no root `package.json` is never reported as drift. Both are negative-controlled: older bytes produce `STALE` + the hint, `version: 0.0.1` against a `9.9.9` package produces the skill hint, and the common case stays silent.

The most valuable thing this item produced is a bug it created and then caught: the freshness check first imported `PLUGIN_BUNDLE` from `plugin-bundle.ts`, which imports the TypeScript compiler API. `typescript` is a devDependency, so a PACKAGED install could not load the CLI at all — `arggon --version` died with `ERR_MODULE_NOT_FOUND: Cannot find package 'typescript'`, and `headless-ci` failed with `expected 1 to be +0`. Fixed by moving the two seam paths into an import-free `cli/src/plugin-paths.ts` (re-exported from `plugin-bundle.ts`, one source of truth), so `dist/doctor.js` never reaches the compiler module. A latent packaging landmine closed by the gate that exists for it, on a change that had nothing to do with packaging.

Merged: PR #587 squash -> main. Item done. Also landed: agents.md's "The generated seam bytes are what your session runs" rule (refresh after a release, then restart the session), and `skills/arggon-cli/SKILL.md` at `version: 0.5.0`.
