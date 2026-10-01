---
type: task
status: in_progress
id: task-adr-update-delivery
title: "ADR: update delivery and distribution channel (release pipeline + update channel + skew + tarballs)"
assignee: Arggon
branch: feat/task-adr-update-delivery
parent: story-update-delivery
labels: [delivery, install, adr]
priority: p1
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T14:02:34.916Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr-update-delivery
---
<!--
  Placement (v0): ArggonManager/product-delivery/delivery-updates/story-update-delivery/task-adr-update-delivery.md
  Leaves live only under a story. id is the filename stem: task-adr-update-delivery.
  CLI `arggon create task adr-update-delivery` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR: update delivery and distribution channel (release pipeline + update channel + skew + tarballs)

## Context

Decides what [exploration-update-delivery-016](../../docs/explorations/exploration-update-delivery-016.md)
recommended, closing the gap ADR 0016 deliberately left open ("distribution of
the tool itself … deferred behind its own future ADR"). Maintainer constraints
settled 2026-10-01: serve agent-driven (CI-pinned) and human (global install)
adopters equally; update check is an opt-out registry read, never blocking;
release automation is release-please-style — a human-merged release PR that
publishes lib-then-cli via OIDC trusted publishing, tags, and attaches the
packed tarballs; the release PR pins `@arggondev/lib` exactly (skew fix).

Related: `task-ci-seam-pin-tracks-release` (tooling-and-environment) removes
the manual `ARGGON_VERSION` re-pin the same release flow trips over.

## Acceptance

- [ ] ADR under `ArggonManager/docs/adr/` (next free id — check the directory; exploration placeholder says 0018) with status Proposed, dated sources, alternatives considered (incl. rejected C2 startup guard, D3 standalone binaries, B3 update-notifier dep).
- [ ] Decision covers all four bundles or explicitly defers each with rationale (pipeline automation / update channel / exact-pin skew hardening / GitHub Release tarballs).
- [ ] Non-goals stated: automatic self-update, standalone binaries, `whatsnew` command (stays deferred per ADR 0016), non-npm package managers.
- [ ] Consequences name the operational duties: trusted-publisher config pins the release workflow filename (renaming breaks OIDC binding), lib-first publish order preserved, CHANGELOG per release.
- [ ] Exploration 016's Decision section links the landed ADR and its `status:` flips `open` → `decided`.

## Notes
