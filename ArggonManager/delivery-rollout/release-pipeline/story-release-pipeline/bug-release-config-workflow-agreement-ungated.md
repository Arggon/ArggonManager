---
type: bug
status: todo
id: bug-release-config-workflow-agreement-ungated
title: "Nothing gates the release-please config against the tags `release.yml` actually creates — a one-word omission (`include-component-in-tag`) silently killed releases for five days, and every aborted run reported `success`"
parent: story-release-pipeline
labels: [ci, release, gate-fidelity]
created: "2026-10-07"
updated: "2026-10-07"
---

<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-release-config-workflow-agreement-ungated.md
  Leaves live only under a story. id is the filename stem: bug-release-config-workflow-agreement-ungated.
  CLI `arggon create bug release-config-workflow-agreement-ungated` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Nothing gates the release-please config against the tags `release.yml` actually creates — a one-word omission (`include-component-in-tag`) silently killed releases for five days, and every aborted run reported `success`

## Context

Found on 2026-10-07 while cutting `0.6.0`. The release pipeline had been **dead
since 2026-10-02** and nobody knew, because **every aborted run reported
`success`**.

### What happened

`release-please-config.json` never set `include-component-in-tag`. The official
schema (fetched 2026-10-07, `schemas/config.json`) documents the default as
`true`, so release-please looked for component-prefixed tags:

```
⚠ Found release tag with component '', but not configured in manifest
❯ looking for tagName: arggon-manager-v0.5.0
❯ looking for tagName: lib-v0.5.0
⚠ There are untagged, merged release PRs outstanding - aborting
```

But the tags that exist are plain — `v0.2.0 v0.3.0 v0.4.0 v0.4.1 v0.5.0` —
because `release.yml` creates them that way, which is the **decided contract**
(`spec-release-pipeline-015` invariant 1: _"the root tag `vX.Y.Z` names the exact
commit being published"_; `release.yml:101` does `git tag -a "v${VERSION}"`).
So release-please could never find `v0.5.0`, concluded its own merged release PR
was untagged, and aborted before opening another one. **Permanently: it could not
open any subsequent release PR.**

### Why it was invisible

Verified across 13+ consecutive runs since the 0.5.0 cycle: every one contains
`untagged, merged release PRs outstanding - aborting`, and every one reports
**`success`**. The abort is a `logger.warn` inside a successful job
(`release-please` `src/manifest.ts:936`), so it is invisible to CI status, to any
dashboard reading conclusions, and to anyone who has not read the log line.

This is the same defect class as
`bug-verification-regex-matching-nothing`: a check that cannot fail teaches its
reader that nothing is wrong. The pipeline was confidently green while producing
nothing.

## Acceptance

- [ ] A gate asserts the **release-please config agrees with the tags
      `release.yml` creates** — at minimum that the component-in-tag setting
      resolves to the `vX.Y.Z` form the workflow produces, so the next config
      drift fails loudly instead of aborting inside a green run
- [ ] The gate is **proven with a negative case**: flip `include-component-in-tag`
      in a fixture and confirm the check fails. A gate that has never been seen
      red is not evidence (this repo's own standard — the reject-refactor and
      negative-fixture precedent)
- [ ] The **abort is surfaced**: an aborted release-please run must not report a
      bare `success` that a reader can mistake for progress. Either the workflow
      fails/warns loudly on the abort condition, or it asserts a release PR exists
      when one is expected. State which, and why the chosen shape cannot go red on
      a legitimate no-release push
- [ ] The contract is **written down where the next author reads it**: the tag
      form (`vX.Y.Z`, no component prefix) and the config option that must agree
      with it, in `release.md` or the spec — not only in this item
- [ ] Verified against a real release-please run, not by reading the config:
      observe the run either open the release PR or fail loudly
- [ ] Tests travel with the change; `npm run test`, `npm run test:structure`,
      `npm run lint:structure` green; `arggon validate` green

## Notes

Related and stacked: `bug-autorelease-label-lifecycle-unowned` is the second half
of the same deadlock. Both had to be resolved for `0.6.0` to be proposable, and
either one alone would have kept the pipeline dead.
