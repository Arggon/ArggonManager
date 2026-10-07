---
type: bug
status: todo
id: bug-seam-bundle-stale-snapshot-gate
title: "The native seam loads the kernel bundle ONCE at session start and never re-checks it, so a stale copy silently serves the done gate for the whole session — `doctor` detects it but nothing prompts it, and nothing can repair a loaded catalog"
parent: tooling-and-environment
labels: [native-seam, parity, done-gate]
created: "2026-10-07"
updated: "2026-10-07"
depends_on: [bug-native-seam-bundle-diverges-from-live-kernel]
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-seam-bundle-stale-snapshot-gate.md
  Leaves live only under a story. id is the filename stem: bug-seam-bundle-stale-snapshot-gate.
  CLI `arggon create bug seam-bundle-stale-snapshot-gate` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The native seam loads the kernel bundle ONCE at session start and never re-checks it, so a stale copy silently serves the done gate for the whole session — `doctor` detects it but nothing prompts it, and nothing can repair a loaded catalog

## Context

Split out of `bug-native-seam-bundle-diverges-from-live-kernel` on 2026-10-07,
after the root cause there was isolated. That item carries the divergence and the
mechanism choice; **this one carries the single remaining defect, which is the
one that actually caused a three-day failure.**

### What was measured

- The native seam loads `.opencode/plugins/arggon/index.ts`, a generated,
  gitignored mirror of the committed `opencode/plugins/arggon/index.bundle.ts`.
- The copy on disk was a clean snapshot that **predated `lib/src/brief.ts`**
  (`grep -c 'lib/src/brief.ts'` → **0** in the copy, **3** in the committed
  bundle; copy mtime 2026-10-06 10:00, bundle 2026-10-07 10:31).
- Every `tools.arggon.*` call in that session therefore ran the **old kernel**,
  including the done gate — which refused three legitimate `done` flips that the
  CLI accepted, on three separate items, across the session that merged the very
  kernel the copy lacked.
- `cli/src/plugin-copy.test.ts:80` auto-heals the copy when bytes differ; running
  it rewrote the file and the divergence stopped.

### The defect, precisely

**Not detection.** `arggon doctor` diagnoses the stale copy correctly and prints
an actionable hint naming both remedies (`arggon init` in a tree with no
adopter-modified seam, or `npm test`) plus the session-restart nuance. Verified by
deliberately staling the copy and re-running.

**The defect is that the gate is served from a snapshot taken at session start,
and nothing re-checks it.** A session loads the bundle once; from then on every
mutation runs whatever kernel that snapshot contained, regardless of what landed
on `main` after. `doctor` would have caught it, but nothing prompts an agent to
run `doctor` before flipping an item, and even a finished `doctor` run cannot
repair an already-loaded catalog — the hint says so itself ("restart the
session").

### Why this is worth its own item

For a tracker whose stated value is that a recorded decision cannot be silently
overridden, the mutation gate is the one surface that must not be served by an
arbitrarily stale copy. The failure that actually occurred was a **false
refusal** — noisy, recoverable, and it cost a CLI fallback on every flip. The
**unmeasured** direction is worse: a stale snapshot could **permit** a transition
the live kernel refuses, and nothing in this chain tested that.

## Acceptance

- [ ] The **reverse direction** is tested first, because it is the dangerous one:
      a transition the live kernel **refuses** must also be refused when the seam's
      copy is stale. Build the negative case deliberately — stale the copy, attempt
      the refused transition through the native surface, record observed-vs-expected.
      Until this exists, the blast radius of a stale snapshot is unknown
- [ ] Decide and record the chosen mitigation, with its trade-off stated:
      (a) the seam **refuses mutations** when its loaded bundle is older than the
      committed bundle's mtime, with an actionable message (recoverable, but it
      blocks work mid-session); (b) the seam **re-checks and reloads** the copy
      before a mutating call (no session restart, but a per-call stat and a new
      failure mode if the file changes under it); or (c) the kernel records the
      bundle's checksum at load and stamps it into every mutating envelope, so a
      reader can always see which kernel served the call (report-only, no
      behaviour change, but nothing is prevented)
- [ ] Whatever is chosen, the **false-refusal case is proven fixed** end-to-end:
      a fully-ticked live `## Acceptance` section with unticked history boxes must
      flip to `done` through the native surface, matching the CLI
- [ ] `arggon doctor`'s existing stale-copy detection and hint are **kept** —
      confirmed still firing (it already does; do not regress it while adding the
      mitigation)
- [ ] The fix is reachable by an agent that never runs `doctor`: the mitigation
      must engage on the mutating path itself, not on a report someone has to
      remember to ask for
- [ ] Tests travel with the change; `npm run test`, `npm run test:structure`,
      `npm run lint:structure` green; `arggon validate` green

## Notes

Split from `bug-native-seam-bundle-diverges-from-live-kernel`, which keeps the
divergence record, the three reproductions, and the mechanism choice. When the
mechanism there is chosen, this item's mitigation must agree with it — do not let
the two records prescribe different fixes.

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — premise CONFIRMED, mechanism now precise

Earlier today I downgraded this item's causal premise to "unproven" because a diff of the gate function between two bundle revisions came back identical. **That downgrade was wrong and is withdrawn here.**

The cause is isolated and reproduced on `bug-native-seam-bundle-diverges-from-live-kernel`. Precisely:

- The stale `.opencode` copy was built from a kernel **before PR #656** (`bug-done-gate-counts-checkboxes-inside-comment-blocks`). Its gate counted **every checkbox in the whole item body** — including unticked boxes inside a comment's history — instead of reading only the live `## Acceptance` section.
- The proof is the error string. The native refusal said *"the acceptance checklist in the **item body** still has unchecked boxes"*; the current kernel says *"the **live '## Acceptance' section** still has unchecked boxes"*. The pre-fix wording occurs **1×** in the pre-fix bundle and **0×** in the current kernel; the live wording occurs **2×** in the current kernel. The seam spoke the pre-fix dialect.
- A minimal probe reproduced it: a fully-ticked live section plus a comment carrying unticked boxes → native refuses, CLI refuses for a different stated reason. Two kernels, two verdicts.

## Why my diff came back identical

I compared `6d3bef0c` (the done-gate *fix*) against current, saw the same `acceptanceGate`, and concluded the bundle could not explain it. **I diffed the wrong revision** — the discriminating kernel is `81828441^`, the commit *before* the fix, which I never opened. A negative result from the wrong comparison is not a negative result, and I treated it as one for several hours. That is the error to avoid repeating on this item: **test the version that actually produced the symptom.**

## What this changes here

- **The session-start defect is real.** A session loaded that pre-fix kernel at start and served every mutation from it for three days, including three refusals. This is not a hypothetical about what staleness *could* do.
- **The reverse-direction row is now answerable, not just important.** I know exactly which kernel to swap in (`81828441^`) and which body shape discriminates (ticked live + unticked history), so the test that has been open since this item was filed can be built directly: does that pre-fix kernel, through the native surface, **permit** a transition the current kernel refuses?
- **The fixture for the parent's row 2 now exists** as a documented body shape, so it does not need re-deriving.

The acceptance list stands as written. Nothing here is blocked — but note that the *ordering* matters more now than it did this morning: the mitigation should follow the reverse-direction test, because that test's answer decides whether this is a hygiene fix or a safety fix.
