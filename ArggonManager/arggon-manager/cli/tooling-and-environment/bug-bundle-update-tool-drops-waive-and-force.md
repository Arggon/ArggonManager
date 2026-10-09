---
type: bug
status: todo
id: bug-bundle-update-tool-drops-waive-and-force
title: "gate-parity drift: the vendored bundle's update tool drops --waive and --force, refusing done-flips and steals the CLI permits"
parent: tooling-and-environment
labels: [parity, native-seam, done-gate]
created: "2026-10-09"
updated: "2026-10-09"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-bundle-update-tool-drops-waive-and-force.md
  Leaves live only under a story. id is the filename stem: bug-bundle-update-tool-drops-waive-and-force.
  CLI `arggon create bug bundle-update-tool-drops-waive-and-force` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# bundle-update-tool-drops-waive-and-force

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-09 @Arggon
Measured 2026-10-08 by the zcode-autoharness probe-rule experiment (claim arggon-bundle-kernel-gate-parity, run run-mv0hbyj9-487b169e, ledger .zcode/harness/ledger.jsonl in the autoharness repo). Verdict: REFUTED, high confidence — two independent probes (fixed 16-scenario gate matrix; seeded differential fuzzer, 36 cases) each reproduced the divergence on 2/2 runs against dist/cli.js v0.5.0 (9f9b22cd) and opencode/plugins/arggon/index.bundle.ts.

Divergence 1 — done gate, waive path. Item in_progress with an unticked (or absent) live ## Acceptance contract:
  CLI:   arggon update <id> --status done --waive "<reason>"  -> ACCEPTED (status flips to done)
  bundle: update tool execute({ id, status: "done", waive: "<reason>" }) -> REFUSED, the standard unchecked/no-contract refusal
The bundle's update tool input mapping (id, title, status, assignee, branch, parent, type, unassign, labels, priority, depends_on, add_depends_on, issue, blocked_reason, no_cascade, full) has no waive field, so the inlined kernel never sees the waiver. The refusal message even tells the agent to 'pass --waive' — which that surface cannot act on.

Divergence 2 — claim/steal gate, force path. Item in_progress claimed by alice:
  CLI:   arggon update <id> --assignee bob --force -> ACCEPTED (assignee becomes bob)
  bundle: update tool execute({ id, assignee: "bob", force: true }) -> REFUSED, 'claim conflict ... or pass --force'
No force field in the tool mapping either.

Both divergences are the false-refusal direction (bundle refuses what the CLI permits) — noisy, not unsafe, and the same direction as the 2026-10-06 incident. Everything else in the matrix agreed on all runs: ticked/unticked/history-only/placeholder/CRLF/lowercase-heading/no-contract done shapes, reopen of done/cancelled (both refuse agents), the --steal flag (both refuse when unarmed and when armed+non-TTY — refusal REASONS differ: the CLI names the steal gate, the bundle surfaces the kernel claim conflict).

Reproduction harness: zcode-autoharness examples/probes/arggon-bundle/ (probe-1-gate-matrix.mjs, probe-2-gate-fuzz.mjs); re-running that runner after a fix is the regression tripwire. Probes were read-only against this repo; all mutations happened in /tmp fixtures.
