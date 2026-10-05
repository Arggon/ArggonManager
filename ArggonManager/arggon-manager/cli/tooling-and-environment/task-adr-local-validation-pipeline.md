---
type: task
status: todo
id: task-adr-local-validation-pipeline
title: "ADR 0024: the local validation pipeline — npm scripts own the gate list, the workflow calls them, a parity test holds the two together"
parent: tooling-and-environment
labels: [ci, adr, methodology]
created: "2026-10-05"
updated: "2026-10-05"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-adr-local-validation-pipeline.md
  Leaves live only under a story. id is the filename stem: task-adr-local-validation-pipeline.
  CLI `arggon create task adr-local-validation-pipeline` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0024: the local validation pipeline — npm scripts own the gate list, the workflow calls them, a parity test holds the two together

## Context

Exploration of record:
[`docs/explorations/exploration-local-validation-pipeline-023.md`](../../../docs/explorations/exploration-local-validation-pipeline-023.md)
(classification: **greenfield**, six-phase protocol, ADR 0017).

The demand: a **fully local** validation pipeline that does not depend on GitHub
Actions. The exploration's ground (measured 2026-10-05) is that the work is
**composition, not new machinery** — 10 of the 11 steps in the required `cli` job
already map one-to-one onto an npm script — so the real decision is **where the gate
list lives** and **what a local run is allowed to claim**, because measurement shows
local is not equivalent to CI in two different ways:

1. a stale `lib/dist` produces a **false red** (`npm test` before `npm run build`:
   1 failed / 2691 passed; after `npm run build`: 7/7 green on the failing file), and
2. `smoke:native-start-cold` **silently runs a weaker leg in CI** than on a machine
   with OpenCode (tracked separately as
   `bug-native-start-cold-ci-skips-move-leg`).

The recommendation is cross-cutting, so it lands in an ADR:
**npm scripts own the gate list, `.github/workflows/ci.yml` steps become
`npm run <lane>`, and a parity test holds the two together** — zero new runtime
dependency, and the vendored `arggon.yml` recipe stays untouched so adopters inherit
nothing they must install (which is also what keeps this off the ADR 0018 release
train).

Deciders: the product owner (human) + the Arggon delivery lead, matching ADR 0023.

## Acceptance

- [ ] `ArggonManager/docs/adr/0024-local-validation-pipeline.md` exists, with Status,
      Date and Deciders, and **links
      `exploration-local-validation-pipeline-023`** (it is the exploration that records
      the measurements the decision rests on)
- [ ] The decision is stated as **one** rule — the gate list lives in `package.json`
      and the workflow invokes lanes — not as "keep both in sync", which is the
      failure class this repo already paid for in
      `bug-ci-seam-pin-shell-vs-test-copy-divergence`
- [ ] Consequences name, explicitly: the parity test is a second place to update when a
      gate is added (same tax ADR 0023 accepted for the required-check name), and the
      local verdict **cannot** cover the CI-only gates (the PR-scoped version guard, the
      pinned-lag assertion, publishing) and must say so
- [ ] "The required `cli` check keeps its authority" is recorded, with the reason: a
      required check's status must be set by the app branch protection names, so no
      local run can satisfy it (docs.github.com `about-protected-branches`, accessed
      2026-10-05)
- [ ] Non-goals recorded: **no publishing** (`release.yml` publishes via OIDC trusted
      publishing / `id-token: write`; `auto-done.yml` needs `contents`/`pull-requests`/
      `checks: write`), and **no workflow discovery** — the pipeline enumerates gates,
      it never runs workflows it finds
- [ ] Alternatives recorded with reasons: `act` (depends on Actions by construction, needs
      Docker, cannot fix the diverging gate), go-task / `just` as definition owner
      (new binary precondition for contributors and adopters), lefthook / husky (a
      trigger, not a definition), Dagger (an engine for nine npm scripts), `mise` tasks
      (personal tool, new repo convention), npm-run-all2 (its `engines.node`
      `^22.22.2` would raise the **shipped** Node floor above the repo's declared
      `>=22.12.0`)
- [ ] Interaction with ADR 0023 stated: duration-aware sharding and the aggregator job
      named `cli` are untouched, and this decision must keep working when they land
- [ ] Cross-checked against `arggon validate` and the ADR link convention in
      `docs/convention.md`

## Notes

Until this ADR lands, exploration 023 is the record of the decision — the same
arrangement exploration 022 used while ADR 0023 was pending.
