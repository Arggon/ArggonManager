---
type: bug
status: in_progress
id: bug-release-needs-auth-self-describing
title: "A failed release publish reports `npm ENEEDAUTH` with no pointer to the one-time npmjs.com trusted-publisher setup that resolves it — the runbook names the cause, but nothing on the failure path does"
assignee: arggon-delivery-lead
branch: fix/bug-release-needs-auth-self-describing
parent: story-release-pipeline
labels: [release, docs, failure-mode]
created: "2026-10-09"
updated: "2026-10-12"
claimed_at: "2026-10-12T13:30:29.065Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-release-needs-auth-self-describing
---

<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-release-needs-auth-self-describing.md
  Leaves live only under a story. id is the filename stem: bug-release-needs-auth-self-describing.
  CLI `arggon create bug release-needs-auth-self-describing` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# A failed release publish reports `npm ENEEDAUTH` with no pointer to the one-time npmjs.com trusted-publisher setup that resolves it — the runbook names the cause, but nothing on the failure path does

## Context

Two release attempts were lost to a failure that named no cause.
`.github/workflows/release.yml` publishes `@arggondev/lib` first, then the root
`arggon-manager`, both through npm **OIDC trusted publishing** — the one thing a
human must do once at npmjs.com (`release.md` § "One-time setup: npm trusted
publishers"). npmjs.com does **not** validate a trusted-publisher entry when it
is saved, so a missing or wrong entry only surfaces at publish time — as a bare

```
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in to https://registry.npmjs.org/
```

which says authentication failed without naming the cause. The two real
failures were per-package: a **missing entry for `@arggondev/lib`** and a
**lowercase-org repo string** (`arggon/…` instead of `Arggon/…`) for
`arggon-manager`. A wrong workflow filename and the post-2026-09-03
stage-only default are the same class.

The runbook already documents the cause and the recovery ("One-time setup: npm
trusted publishers"; "Exception: publish fails with an authentication error"),
but **nothing on the failure path pointed there** — the failure and its fix
lived in different documents, so the operator was left grepping the repo for a
string npm had already printed.

### The fix in one line

The two publish steps run through a tested wrapper
(`cli/publish-auth-hint.mjs`): it re-emits npm's own stderr verbatim and, on a
**genuine** authentication failure only, prints the cause, the package that
failed, `npm trust list <package>`, the exact repo/workflow-filename binding and
the case-sensitivity warning, plus where the full recovery lives. Publish
semantics are untouched (the wrapper exits with npm's status).

## Acceptance

- [x] When a publish step fails with an authentication error, the workflow prints a self-describing failure on the failure path itself: the cause (npm OIDC trusted-publishing authentication failed), which package failed, and the pointer to the one-time setup — `release.md`'s "One-time setup: npm trusted publishers" section, `npm trust list <package>` as the fastest check, the repo/workflow-filename binding, and the case-sensitivity warning (org is `Arggon`, capital A)
- [x] The mechanism covers BOTH publish steps — `@arggondev/lib` and `arggon-manager` — the two failures that cost this repo two attempts were per-package
- [x] Only genuine auth failures get the pointer: a network error, a 404 on a name typo, a pack failure or anything else must not be mistranslated as an auth failure (a wrong hint on a real failure is worse than none)
- [x] Tests travel with the change: the failure classification/formatting is a tested module with unit tests including a negative case (a non-auth failure is NOT mistranslated)
- [x] Offline smoke evidence: run the module against a fixture npm error log (expected vs observed) — no real publish, no network dependency
- [x] Repo gates green: `npm run test`, `npm run test:structure`, `npm run lint:structure`, `npm run arggon -- validate`; `npx prettier --check` on changed files; if `npx actionlint` is available, the workflow stays clean
- [x] The change does NOT restructure `release.yml`'s publish semantics: lib-first order, "already published = success", propagation poll, OIDC-only (no `NPM_TOKEN`) all unchanged — and the workflow filename stays `release.yml` (the trusted-publisher binding; renaming is a breaking ops change)

## Notes
