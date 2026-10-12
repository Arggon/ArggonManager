---
type: bug
status: todo
id: bug-release-needs-auth-self-describing
title: "A failed release publish reports `npm ENEEDAUTH` with no pointer to the one-time npmjs.com trusted-publisher setup that resolves it — the runbook names the cause, but nothing on the failure path does"
parent: story-release-pipeline
labels: [release, docs, failure-mode]

created: "2026-10-09"
updated: "2026-10-09"
---

<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-release-needs-auth-self-describing.md
  Leaves live only under a story. id is the filename stem: bug-release-needs-auth-self-describing.
  CLI `arggon create bug release-needs-auth-self-describing` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# A failed release publish reports `npm ENEEDAUTH` with no pointer to the one-time npmjs.com trusted-publisher setup that resolves it — the runbook names the cause, but nothing on the failure path does

## Context

This item has zero dated Notes; the defect is grounded in the named authorities below, not in transcribed testimony.

**The failure path that exhibits it.** `.github/workflows/release.yml:204-220` (Publish the kernel first) and `:249-259` (Publish the CLI) run bare `npm publish --workspace lib` / `npm publish` behind only an already-published idempotency check. The workflow's own header (`release.yml:31-36`) states the design intent plainly: OIDC trusted publishing ONLY, no `NPM_TOKEN` anywhere, failing closed until the one-time npmjs.com setup exists (repo `Arggon/ArggonManager`, workflow filename `release.yml`, no environment, direct publish allowed — for BOTH packages). When that setup is absent or wrong, npm reports `ENEEDAUTH` — authentication failed, with no pointer to which of the four binding fields is wrong.

**The runbook names the cause, but nothing on the failure path does.** `release.md:58-61` states the exact trap: "npm does not verify the configuration when you save it, so a wrong value only surfaces at publish time — as `ENEEDAUTH`, which says authentication failed without naming the cause. The org here is `Arggon`, capital A." `release.md:40-53` is the one-time setup (both packages, filename binding, direct-publish selection); `release.md:75-80` gives the fastest diagnostic (`npm trust list <package>`, 2FA-protected read) and records the two failures that already cost this repo two release attempts (a missing entry for `@arggondev/lib`, a lowercase-org repo string for `arggon-manager`); `release.md:139-149` (Exception: publish fails with an authentication error) is the recovery (fix the config, "Re-run failed jobs", guard idempotent re-entry). None of that is reachable from the failed step's own output: the publish steps echo only the already-published short-circuit (`release.yml:217`, `:256`) and otherwise let npm's bare `ENEEDAUTH` stand as the whole diagnosis. The spec agrees this path is runtime-pending: `ArggonManager/docs/specs/spec-release-pipeline-015.md:457-462` (A17) states publishing stays inert until the human completes the trusted-publisher setup, with the publish path itself listed as observed-only-on-first-real-release.

So the operator who hits the red publish step — the exact person the exception manual was written for — must already know `release.md` exists and which section to open. A failed publish should name its own remedy: the one-time setup section, the four binding fields, and the `npm trust list` diagnostic.

## Acceptance

- [ ] A publish step that fails with an npm authentication error (`ENEEDAUTH` or its OIDC equivalent) names the one-time npmjs.com trusted-publisher setup as the first suspect, with a pointer to `release.md` §One-time setup (not just the bare npm error text)
- [ ] The pointer names the four binding fields that must match exactly (repository `Arggon/ArggonManager`, workflow filename `release.yml`, no environment, direct `npm publish` allowed, for BOTH packages), including the case-sensitive-org gotcha from `release.md:58-61`
- [ ] The pointer names the fastest diagnostic (`npm trust list <package>` per `release.md:75-80`) so the operator checks the configured publisher before re-running
- [ ] The recovery stays the documented one (fix the config, "Re-run failed jobs", guard idempotent re-entry per `release.md:139-149`) — no new fallback, no token path, still fails closed
- [ ] `npm test` green (if the pointer is a tested step-body string, the assertion pins it rather than restating it); `arggon validate` green; prettier clean

## Notes
