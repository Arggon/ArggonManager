---
type: bug
status: todo
id: bug-release-label-flip-verification-index-lag
title: "release-label-flip's post-flip verification reads the search index ~0.4s after the edit and can warn 'still pending' on a healthy release (observed live on v0.7.0)"
parent: story-release-pipeline
labels: [release, ci, failure-mode]
created: "2026-10-12"
updated: "2026-10-12"
---

<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-release-label-flip-verification-index-lag.md
  Leaves live only under a story. id is the filename stem: bug-release-label-flip-verification-index-lag.
  CLI `arggon create bug release-label-flip-verification-index-lag` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# release-label-flip's post-flip verification reads the search index ~0.4s after the edit and can warn 'still pending' on a healthy release (observed live on v0.7.0)

## Context

Observed live on the first real release since the label lifecycle landed
(2026-10-12, v0.7.0; release run 38296293861):

```
release-label-flip: flipped #744 chore: release main: 'autorelease: pending' -> 'autorelease: tagged'
release-label-flip: WARNING — still 'autorelease: pending' on 1 merged release PR(s) after the flip —
release-please WILL abort until they are cleared. The backstop reddens the next push naming them; manual recovery: …
```

Minutes later the live state was clean: `gh pr list --state merged --label
"autorelease: pending"` → `[]`, `#744` → `autorelease: tagged`. The flip had
succeeded; the **verification re-query hit GitHub's search-index lag**
(`gh pr list` is backed by search and is eventually consistent — the same lag
was observed by hand earlier the same day, where the query still returned a
just-flipped PR for a few seconds). The script's verification runs ~0.4 s after
the edit, so on a healthy release it can emit "release-please WILL abort" —
the crying-wolf shape this whole work stream exists to remove. A warning that
fires on every successful release trains readers to ignore the real one.

## Acceptance

- [ ] The post-flip verification is authoritative or tolerates the search lag:
      e.g. verify per-PR via `gh pr view <n> --json labels` (not the search
      query), or retry the search query with a short bound — state which and why
      it cannot mask a genuinely stuck label
- [ ] Tested: a healthy flip whose search re-read lags returns no warning; a
      genuinely stuck label still warns and names the recovery (pin both shapes)
- [ ] The backstop's fail-closed behaviour is unchanged (unknown state elsewhere
      still reddens per its own contract); only the repair's self-verification
      changes
- [ ] Re-verified on a real release run (the next cut): the flip completes with
      no warning when it succeeded — expected vs observed recorded here

## Notes
