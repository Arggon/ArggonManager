---
type: bug
status: in_progress
id: bug-release-notes-extraction-breaks-on-linked-header
title: "release.yml's CHANGELOG notes extraction cannot match release-please's linked header, stranding the release after the tag"
assignee: Arggon
branch: fix/bug-release-notes-extraction-breaks-on-linked-header
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [release, ci]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T13:45:30.907Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-release-notes-extraction-breaks-on-linked-header
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-release-notes-extraction-breaks-on-linked-header.md
  Leaves live only under a story. id is the filename stem: bug-release-notes-extraction-breaks-on-linked-header.
  CLI `arggon create bug release-notes-extraction-breaks-on-linked-header` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# release.yml's CHANGELOG notes extraction cannot match release-please's linked header, stranding the release after the tag

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator — the first fully-automated release, stranded after the tag
`v0.5.0` (PR #556, squash `13d72f5f`) failed in `release.yml` at the "GitHub Release … notes" step:

```
CHANGELOG.md has no '## [0.5.0]' section - the merged release section is the notes source; refusing to create an empty release
```

Root cause: the step builds `pattern="^## \\[${VERSION//./\\.}\\]"` and matches it with `awk '$0 ~ pat'`. The merged header is release-please's LINKED form — `## [0.5.0](https://github.com/…/compare/arggon-manager-v0.4.1...arggon-manager-v0.5.0) (2026-10-02)` — and the pattern anchors to the closing `]` with nothing allowed after it, so a linked header never matches. The published 0.4.1 section used the plain `## [0.4.1] - 2026-10-01` form, and 0.4.1 shipped through the retired MANUAL path, so this awk had never run against a release-please header before. Fails CLOSED (good) but after the tag step, which is the expensive place to fail.

State right now: the annotated tag `v0.5.0` exists and peels to the release commit (the guard's rule-1 path completed the tag + lockstep agreement); no GitHub Release object, nothing published to npm (`npm view arggon-manager@0.5.0` → 404). The re-run path cannot fix it: a re-run uses the workflow definition at the run's own commit (the broken one), and the guard has no rule that re-enters a release for a commit whose version is unchanged (rule 0) or whose tag already names it (rule 2) — so the remaining steps need the documented operator exception, which I am running now (release object with the curated notes, then pack/inspect/publish lib → CLI, tarballs attached, build-info stamped for `13d72f5f`).

## Acceptance
- [ ] Replace the inline awk with a testable extractor that matches the section by its `## [V]` prefix regardless of what follows (linked or plain), and call it from the workflow; unit tests cover the linked header, the plain header, a missing section (still fails loudly, no empty release) and the stop-at-the-next-`## `-heading rule.
- [ ] Order: extract + validate the notes BEFORE the tag step, so a notes problem can never strand a published tag again (the fail-closed behavior stays; only its position moves).
- [ ] Record the manual completion of 0.5.0 in release.md as the first entry under the operator's exceptions, with the exact commands, so the next operator has the path.
