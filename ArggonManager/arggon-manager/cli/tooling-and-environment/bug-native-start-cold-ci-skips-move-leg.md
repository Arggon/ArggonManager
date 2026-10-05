---
type: bug
status: todo
id: bug-native-start-cold-ci-skips-move-leg
title: "`smoke:native-start-cold` runs a weaker leg in CI than on any machine with OpenCode: the MOVE leg is silently reported `ok: true` when the `opencode` binary is absent — and on `opencode` v2.0.23 that leg is RED"
parent: tooling-and-environment
labels: [ci, smoke, gate-fidelity]
created: "2026-10-05"
updated: "2026-10-05"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-native-start-cold-ci-skips-move-leg.md
  Leaves live only under a story. id is the filename stem: bug-native-start-cold-ci-skips-move-leg.
  CLI `arggon create bug native-start-cold-ci-skips-move-leg` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `smoke:native-start-cold` runs a weaker leg in CI than on any machine with OpenCode: the MOVE leg is silently reported `ok: true` when the `opencode` binary is absent — and on `opencode` v2.0.23 that leg is RED

## Context

Found by the delivery lead while grounding
[`exploration-local-validation-pipeline-023`](../../../docs/explorations/exploration-local-validation-pipeline-023.md),
2026-10-05. **Both halves are measured, not inferred.**

`smoke:native-start-cold` is a **BLOCKING** step of the required `cli` check. Its
strongest leg (item 6 in its own header: a real `opencode serve`, a real session move, a
scripted in-process OpenAI-compatible provider driving one Code Mode `execute` call) runs
**only when the `opencode` binary is on PATH**. Otherwise it prints
`move leg skipped: the opencode binary is not installed (CI) — run where OpenCode V2 is
available` and records it as **`ok: true`** (`smoke/native-start-cold-smoke.ts:2177-2191`).

**CI runs the weaker leg.** `.github/workflows/ci.yml` has no step that installs
`opencode`, and the log of run `37362522012` (2026-10-05) contains exactly that skip
line, inside a 3-second step:

```text
ok   move leg skipped: the opencode binary is not installed (CI) — run where OpenCode V2 is available
```

So the required gate and the gate a developer runs are **two different tests wearing one
name** — and the strong leg is currently **red**. On this machine (`opencode` v2.0.23,
node v26.7.0) `npm run smoke:native-start-cold` exits 1 after ~13 s:

```text
FAIL the scripted drive was exactly one execute round with the native comment script, then a closing text round
      the final text round preceded the tool round
```

The failure is a **host-behaviour** assertion (which canned round the host consumes
first), not a defect in the seam the smoke guards — the commit leg is green in the same
run ("the commit leg: the scripted native call committed to the item branch IN the
worktree; the primary is untouched").

This also contradicts the evidence recorded in `ci.yml`: "Observed runtime ~0.5s (5/5
local runs: 0.47-0.48s, 20/20 checks)" matches the **skipped-leg** configuration, not
today's local run (13 s, failed). The "MODEL-FREE … needs no provider, no quota" claim is
_accurate_ — the provider is scripted and in-process — but it is not the same claim as
"runs the same thing everywhere".

## Acceptance

- [ ] **Decide, explicitly, which leg the required `cli` check is** — the strong leg
      (install a pinned `opencode` in the job and hold the host version so the turn-order
      assertion is stable) or the skip-as-`ok` leg (rename it so the skip is visibly a
      skip, and record that the strong leg runs only where OpenCode is installed). A
      silent `ok: true` on a skipped gate is not one of the two
- [ ] Whatever is decided is **written where a reader of `ci.yml` will see it** — the
      comment block that currently asserts 20/20 local checks and ~0.5 s
- [ ] If the strong leg is kept in CI: the host version it runs against is **pinned**,
      and the turn-order assertion is either made host-version-tolerant or proven stable
      across the OpenCode versions the plugin claims to support
- [ ] If it is red for a real reason on `opencode` v2.0.23, that reason is **fixed or
      filed as its own item** — this item is about gate fidelity, not about swallowing
      the failure
- [ ] The skip, wherever it survives, is **visible in the verdict** (a named `skipped`
      line the reader cannot mistake for `ok`) — the same class of defect as
      `bug-done-gate-counts-checkboxes-inside-comment-blocks`
- [ ] `docs/opencode2.md:389` (and `:399`, which already says this smoke "needs" more
      than the others) agree with the final behaviour
- [ ] Re-run recorded expected-vs-observed: the exact command, the exit code, and the
      resolved configuration (whether `opencode` was on PATH)

## Notes

Not caused by, and not fixed by,
[`exploration-local-validation-pipeline-023`](../../../docs/explorations/exploration-local-validation-pipeline-023.md):
that exploration _records_ the divergence as the reason a local verdict must print its
resolved profile. Fixing the gate is independent work.
