---
type: bug
status: todo
id: bug-seam-bundle-stale-snapshot-gate
title: "The native seam loads the kernel bundle ONCE at session start and never re-checks it, so a stale copy silently serves the done gate for the whole session — `doctor` detects it but nothing prompts it, and nothing can repair a loaded catalog"
parent: tooling-and-environment
labels: [native-seam, parity, done-gate]
created: "2026-10-07"
updated: "2026-10-07"
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
