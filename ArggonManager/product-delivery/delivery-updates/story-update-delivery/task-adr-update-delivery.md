---
type: task
status: done
id: task-adr-update-delivery
title: "ADR: update delivery and distribution channel (release pipeline + update channel + skew + tarballs)"
assignee: Arggon
branch: feat/task-adr-update-delivery
parent: story-update-delivery
labels: [delivery, install, adr]
priority: p1
created: "2026-10-01"
updated: "2026-10-01"
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

### 2026-10-01 @ses_f0870e73affeEVvaFZPi9K7NDj
ADR 0018 landed (PR #537, merge 6caa05ca) and is Accepted (flip 3c2b4568: file + index row in the same commit — no 0016-style lag).

Verdict trail: reviewer verdict request-changes on the first pass — one blocking finding (prettier rewrites multi-line code spans; cli/prose-format gate red) + one CI-semantics ambiguity + one process note (untracked Accepted flip). All three addressed: code spans single-lined (prose-format 3/3 green locally), CI pinned as "GET never runs on CI; JSON fields report cache state", and the Accepted flip executed at merge with the index row together. All lanes green before merge (cli 5m26s, ui-smoke, tasks-validate).

Same PR also corrected ADR 0016 Proposed → Accepted (evidence: exploration-007's Decision records adoption; stages shipped; dated status note added) and flipped exploration-016 to decided with the ADR link; spec analyze reports no findings for exploration-016 post-merge.

Next steps (decompose after this ADR, per its Consequences):
1. Pipeline story first: release-please manifest + release.yml (OIDC trusted publishing, lib-first with propagation retry, tarball assets) + exact kernel pin + land task-ci-seam-pin-tracks-release with/before it. One-time ops setup on npmjs.com: trusted publishers for arggon-manager and @arggondev bound to .github/workflows/release.yml.
2. Then the update-channel story: spec first (acceptance criteria lifted from exploration-016's edge-case table), then implementation (~50 lines, no new deps).

Observation for the tracker owner (not filed — out of this item's scope): the ADR index (docs/adr/README.md) is missing rows 0014–0017.
