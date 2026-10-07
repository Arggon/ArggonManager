---
type: bug
status: todo
id: bug-native-seam-bundle-diverges-from-live-kernel
title: "The native seam runs a frozen single-file bundle of the kernel, and it computed a different done-gate verdict than the CLI on the same file — `tools.arggon.update --status done` refused a flip the CLI accepted, with both `lib/src` and `lib/dist` independently returning `gated:false`"
parent: tooling-and-environment
labels: [native-seam, parity, done-gate, cli]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-native-seam-bundle-diverges-from-live-kernel.md
  Leaves live only under a story. id is the filename stem: bug-native-seam-bundle-diverges-from-live-kernel.
  CLI `arggon create bug native-seam-bundle-diverges-from-live-kernel` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The native seam runs a frozen single-file bundle of the kernel, and it computed a different done-gate verdict than the CLI on the same file — `tools.arggon.update --status done` refused a flip the CLI accepted, with both `lib/src` and `lib/dist` independently returning `gated:false`

## Context

Found during merge verification of `task-adr-0026-owner-decision-brief`
(PR #659), 2026-10-06. Every claim below is measured on `main` at
`cbf9656c`+; nothing is inferred.

### The observation

The same transition, on the same file, in the same working tree, refused by one
surface and accepted by the other:

| Surface             | Call                                          | Result                                                                              |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| native tool         | `tools.arggon.update({ id, status: "done" })` | **refused** — "the acceptance checklist in the item body still has unchecked boxes" |
| CLI                 | `npm run arggon -- update <id> --status done` | **accepted** — `arggon update: task … (status, claimed_at)`, exit 0                 |
| kernel, from source | `acceptanceGate(body)` on `lib/src/items.ts`  | `{"gated": false}`                                                                  |
| kernel, from build  | `acceptanceGate(body)` on `lib/dist/items.js` | `{"gated": false}`                                                                  |

The item's live `## Acceptance` section was fully ticked, so the CLI was right
and the native surface was wrong. The flip was then made legitimately through the
CLI.

### The structural cause (measured)

The native seam does **not** execute the kernel. It executes a single-file
bundle, `.opencode/plugins/arggon/index.ts` — **476 KB**, embedding its own
snapshot of `lib/src` (it contains `liveAcceptanceRegion` and both done-gate
refusal reasons, `no-live-contract` and `unchecked-live-criteria`). The CLI
executes the live source. So the invariant "one logic path"
(ADR 0010/0011) holds for the CLI and **not** across the seam: there are two
copies of every kernel rule, and only one of them is the one a reviewer reads.

Two aggravating facts, both measured:

- **The bundle is not tracked by git** (`git log -- .opencode/plugins/arggon/index.ts`
  is empty). It is a locally generated artifact, so its staleness is invisible to
  CI, to review, and to `arggon doctor`. Two machines can run different kernels
  from the same commit.
- **Nothing measures the divergence.** The acceptance-parity suite compares
  _output shapes_, not verdicts on a real body — the defect
  `bug-parity-suite-cannot-catch-wrong-input-at-call-sites` names from the other
  side. A kernel that returns the wrong `gated` verdict on a valid input is
  invisible to it.

### What is NOT established

**Which line in the bundle computes the different verdict is not yet isolated.**
The bundle contains the same refusal reasons and the same helper names as the
live source, so "the bundle predates the fix" is **not** demonstrated — and
`lib/dist` (09:59) and the bundle (10:00) postdate the `bug-done-gate-*` work, so
staleness-by-recency is not the explanation either. Do not record a cause here
that the evidence does not carry; isolate it first.

### Why this matters more than the one flip

The measured failure is a **false refusal**, which is noisy but safe. The
dangerous direction is the reverse, and it is a risk rather than a measurement: a
rule the bundle predates could **permit** through the native surface something
the CLI refuses. For a tracker whose stated value is that a recorded decision
cannot be silently overridden, a gate that exists in one copy and not the other
is exactly the wrong failure to leave standing.

## Acceptance

- [ ] The divergent verdict is **isolated**: identify the specific code in the bundle
      that computes a different `gated` than `lib/src` on this body. Until that is
      done, this bug's cause stays open — a plausible cause recorded as fact is the
      defect class this repo already tracks
- [ ] Reproduced as a **test**, not a comment: a fixture item with a fully ticked live
      `## Acceptance` section **and** unticked history boxes in a dated comment must
      flip to `done` through **both** surfaces, and both must agree. A test that only
      exercises the CLI proves nothing here
- [ ] The two copies cannot drift silently again. Choose one and record why in the
      item: (a) the native seam loads the **live kernel** rather than a snapshot, (b)
      the bundle becomes a **tracked, CI-verified build artifact** regenerated by a
      gate that fails when it differs from the source it bundles, or (c) the bundle is
      refused at load time when its snapshot is behind the live source
- [ ] If (b) or (c): the parity surface compares **verdicts on real bodies**, not just
      envelope shapes — closing the input-coverage half of `bug-parity-suite-cannot-catch-wrong-input-at-call-sites`
      for this path
- [ ] `arggon doctor` reports a stale or unverified seam bundle, so the condition is
      visible before a decision depends on it — today it is invisible to every surface
- [ ] Reverse direction checked explicitly: a transition the **live kernel refuses**
      must also be refused by the native surface. Proven with a negative case, not asserted
- [ ] Tests travel with the change; `npm run test`, `npm run test:structure`,
      `npm run lint:structure` green; `arggon validate` green

## Notes

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — third reproduction

**Three of three.** The native-seam divergence reproduced again on `task-wire-decision-brief-carriers`:

| Surface | Call | Result |
| --- | --- | --- |
| native tool | tools.arggon.update({ id, status: "done" }) | **refused** — "still has unchecked boxes" |
| CLI | npm run arggon -- update <id> --status done | **accepted** — committed 321a82c8 |
| kernel, from source | live '## Acceptance' section | **8 of 8 ticked, 0 unchecked** |

Items: ADR 0026 (#659), the spec (#660), the carriers (this one). Three different items, three different branches and worktrees, the same verdict split every time, and in every case the live contract was complete.

What this changes about the diagnosis: the pattern is now stable enough to predict. Every `done` flip on this chain had to fall back to the CLI. That is no longer a curiosity — it is the normal path, which means the native `update` surface cannot currently be trusted for the one transition the whole tracker is built around.

Still **not isolated**: which line in the bundle computes the different verdict. Three reproductions narrow it to the done-gate verdict on a fully-ticked live section and rule out the per-item/per-branch explanations; they do not identify the cause. The acceptance's first row stands as the first thing to settle, and the reverse direction (a rule the bundle predates *permitting* something the live kernel refuses) remains unmeasured.
