---
type: bug
status: todo
id: bug-generated-seam-bytes-predate-050
title: "The generated OpenCode seam bytes are one release behind: the vendored plugin copy predates 0.5.0, so the live native surface has none of the worktree-isolation features"
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

- [ ] `.opencode/plugins/arggon/index.ts` regenerated from the current bundle: `foreignWrites`,
      `arggon-claim.json`, `ARGGON_WORKTREE_ID` and the compose-prune call all present, and its
      provenance header matches the bundle build that produced it.
- [ ] `npm run check:plugin` green, and a regression check exists that fails when the vendored copy
      is older than the bundle (the copy is untracked, so the check must compare content/provenance,
      not git timestamps).
- [ ] Documented in `ArggonManager/docs/agents.md` (or the CLI skill): after pulling a new release, a
      session must refresh the generated seam bytes before it may rely on new native capabilities —
      the catalog it loaded is whatever was on disk at session start.
- [ ] `skills/arggon-cli/SKILL.md` frontmatter `version:` bumped to match the release, with whatever
      drift guard keeps it in step.
- [ ] Evidence recorded on the item: the marker-count table above, re-run after the refresh.
