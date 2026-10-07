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

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — root cause ISOLATED, and one premise in this item is wrong

## The cause, measured

The native seam loads `.opencode/plugins/arggon/index.ts`, a **generated, gitignored mirror** of the committed `opencode/plugins/arggon/index.bundle.ts`. The copy on disk was a **stale snapshot that predated `lib/src/brief.ts`** — `grep -c 'lib/src/brief.ts'` returned **0** in the copy and **3** in the committed bundle. Its mtime (2026-10-06 10:00) was older than the bundle (2026-10-07 10:31). So the seam was executing a kernel from before the done-gate work, while the CLI executed the live one. That is the whole divergence.

**The fix is that the copy is auto-healed by the test suite.** `cli/src/plugin-copy.test.ts:80` rewrites the derived copy whenever its bytes differ from the expected stamp. Running it moved the copy's mtime to 12:38 and it now matches the committed bundle byte-for-byte (verified by diff, minus the generated marker).

**So the earlier framing in this item was partly wrong and I am correcting it here rather than leaving it:** I wrote that the condition is "invisible to CI, to review, and to `arggon doctor`". The first two are true; **the third is false.** `doctor` already diagnoses it. I verified by deliberately removing the brief-module registration and re-running:

```
opencode: config opencode.jsonc, seam 16 artifact(s), vendored plugin STALE, ...
hint: the vendored plugin copy predates the committed bundle — regenerate it before
      relying on new native capabilities (`arggon init` on a tree with no
      adopter-modified seam, or `npm test`, which rewrites the copy) and restart the
      session: the catalog it loaded is whatever was on disk at start
```

That hint is accurate, names both remedies, and even explains the session-restart nuance. The acceptance row asking for `doctor` visibility is therefore **already satisfied** — it should be struck, not implemented.

## What the real, still-open defect is

Not detection. **The seam never re-checks after load.** A session loads the bundle once at startup; if the copy is stale at that moment, every later `tools.arggon.*` call in that session runs the old kernel — which is exactly what happened here, three times, across a three-day session that merged the very kernel the copy lacked. `doctor` would have told us, but nothing prompted it, and nothing could have fixed the loaded catalog mid-session.

So the shape is: **the mutation gate itself is served from a snapshot that can be arbitrarily stale, and the only signal is a report nobody is obliged to run.** For a tool whose value is that a gate cannot be silently bypassed, that is the wrong failure to leave standing — and the direction I originally flagged as *unmeasured* (a stale copy **permitting** what live refuses) is the dangerous half.

## Consequence for the acceptance list

- Row 1 (isolate) — **done**, above.
- Row 5 (`doctor` visibility) — **already true**; propose striking it as satisfied-by-existing-behaviour.
- Row 3 (choose a mechanism) — the live options are now sharper: the copy is already regenerated by `npm test`, so the question is whether the **seam** should refuse a bundle older than the source it inlines, rather than trusting a startup read.
- Row 6 (reverse direction) — unchanged and now the most valuable row: nothing here tested whether a stale copy **allows** a transition live refuses.
- Rows 2, 4, 7 — unchanged.
