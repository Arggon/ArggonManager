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

- [x] ADR under `ArggonManager/docs/adr/` as **0018-update-delivery-and-distribution-channel.md** — `Proposed` in PR #537, flipped to **Accepted** on merge per the ADR lifecycle (flip commit 3c2b4568, file + index row together, so no 0016-style drift).
- [x] Decision covers all four bundles: pipeline automation (release-please-style release PR + OIDC trusted publishing, lib-then-cli, tarball assets), update channel (bounded opt-out check, agent-first JSON), exact-pin skew hardening, GitHub Release tarballs — with rejected alternatives recorded (C2 startup guard, D3 binaries, B3 update-notifier, release-it/changesets, A1/A2).
- [x] Non-goals stated: automatic self-update, standalone binaries, `whatsnew` (stays deferred per ADR 0016), non-npm package managers.
- [x] Consequences name the operational duties: trusted-publisher config binds the workflow filename, npm ≥ 11.5.1 on the runner, lib-first order preserved, additive JSON documented same PR, `task-ci-seam-pin-tracks-release` lands with/before the pipeline. Review finding 3 resolved: on CI the GET never runs; JSON fields report cache state (explicit unknown otherwise).
- [x] Exploration 016's Decision section links the landed ADR and its `status:` flipped `open` → `decided` (merged in the same PR); `spec analyze` reports no findings for exploration-016 after merge.

## Notes
